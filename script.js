// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDfQEHk44JiV4mGQjOHcyyDBgp0dSqfkBE",
  authDomain: "tpq-al-mubarok.firebaseapp.com",
  projectId: "tpq-al-mubarok",
  storageBucket: "tpq-al-mubarok.firebasestorage.app",
  messagingSenderId: "169834752758",
  appId: "1:169834752758:web:a249231849f9c32a73dad7",
  measurementId: "G-57HT9Y0VMT"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

window.userName = ""; 
window.parentName = "";
window.currentRole = "";

window.confirm = async function(message) {
    const result = await Swal.fire({
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#198754', // Warna hijau
        cancelButtonColor: '#d33',    // Warna merah
        confirmButtonText: 'Ya, Lanjutkan',
        cancelButtonText: 'Batal'
    });
    return result.isConfirmed; 
};

window.alert = function(message) {
    Swal.fire({
        text: message,
        icon: 'info',
        confirmButtonColor: '#198754'
    });
};

// Variables Global
let currentUser = null;
let currentRole = null; // 'admin' atau 'parent' atau 'superadmin'
let studentsData = [];
let statusSebelumnya = null;

// --- AUTHENTICATION ---

// Cek status login
    auth.onAuthStateChanged((user) => {
        const loader = document.getElementById('loading');
        if (loader) loader.classList.remove('d-none');

        if (user) {
            currentUser = user;
            // Gunakan onSnapshot agar otomatis mendeteksi perubahan di Firebase Console
            const unsubscribe = db.collection('users').doc(user.uid).onSnapshot(async (userDoc) => {
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    currentRole = userData.role;

                    setTimeout(() => {
    showPage('home');
}, 100);

                    // --- PEMBERSIHAN TOTAL (Mencegah "Ustadzah Ustadz") ---
                    // 1. Ambil nama asli saja. JANGAN tambahkan default "Ustadzah" di sini
                    let namaMurni = userData.nama || userData.name || "Pengajar";
                    
                    // 2. Deteksi panggilan berdasarkan field gender di Firebase
                    // Jika gender "Pria", panggilan "Ustadz". Jika tidak, baru "Ustadzah"
                    const gender = userData.gender || "Wanita";
                    const panggilan = (gender === 'Pria') ? "Ustadz" : "Ustadzah";
                    
                    // 3. Gabungkan hasil akhir
                    const sapaanFinal = `${panggilan} ${namaMurni}`;

                    // 4. Update ke tampilan (Hanya panggil ini SATU KALI)
                    window.userName = sapaanFinal;
                    if (typeof displayGreeting === "function") displayGreeting(sapaanFinal);

                    if (statusSebelumnya === false && userData.isApproved === true) {
    // MATIKAN LOADER DI SINI AGAR TIDAK STUCK SAAT ALERT MUNCUL
    if (loader) loader.classList.add('d-none'); 

    Swal.fire({
        title: "Alhamdulillah!",
        text: `Selamat ${sapaanFinal}, akun Anda telah disetujui. Membuka dasbor...`,
        icon: "success",
        timer: 3000,
        showConfirmButton: false
    });
}
// Update status pelacak
statusSebelumnya = userData.isApproved;

                    // --- LOGIKA OTOMATIS MASUK ---
                    if (currentRole === 'admin' && userData.isApproved === false) {
                        if (loader) loader.classList.add('d-none'); 
                        document.getElementById('loginSection').classList.add('d-none');
                        document.getElementById('mainNavbar').classList.add('d-none');
                        if (typeof hideAllPages === "function") hideAllPages();
                        const waitingRoom = document.getElementById('waitingRoom');
                        if (waitingRoom) {
                            waitingRoom.classList.remove('d-none');
                            
                            // MENGISI NAMA (Menggunakan sapaanFinal yang sudah didefinisikan)
                            const waitingName = document.getElementById('waitingName');
                            if (waitingName) {
                                waitingName.innerHTML = `Assalamu'alaikum<br><span style="font-size: 1.2rem;">Mohon Maaf, ${sapaanFinal}</span>`;
                            }
                        }
                        
                        // Berhenti di sini, jangan lanjut ke kode dashboard
                        return; 
                    }

                    // --- TAMPILKAN DASHBOARD ---
                    const waitingRoom = document.getElementById('waitingRoom');
                    if (waitingRoom) waitingRoom.classList.add('d-none');
                    document.getElementById('loginSection').classList.add('d-none');
                    document.getElementById('mainNavbar').classList.remove('d-none');

                    if (currentRole === 'admin' || currentRole === 'superadmin') {
                        showPage('admin');
                        await renderStudents();
                        await renderUstadzah();
                    } else {
                        showPage('parent');
                        await loadChildData(user.email);
                    }

                    if (loader) loader.classList.add('d-none');
                    if (unsubscribe) unsubscribe(); 

                } else {
                    await auth.signOut();
                    if (loader) loader.classList.add('d-none');
                }
            });
        } else {
            document.getElementById('loginSection').classList.remove('d-none');
            document.getElementById('mainNavbar').classList.add('d-none');
            hideAllPages();
            if (loader) loader.classList.add('d-none');
        }
    });

// Login Function
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loader = document.getElementById('loading'); // Simpan di variabel agar rapi

    // 1. Tampilkan loader
    loader.classList.remove('d-none');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
            
    } catch (error) {
        // 2. Matikan loader hanya jika terjadi error (salah password/jaringan)
        if (loader) loader.classList.add('d-none');
        
        let msg = error.message;
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            msg = "Email atau Password salah!";
        } else if (error.code === 'auth/network-request-failed') {
            msg = "Koneksi internet bermasalah!";
        }

        Swal.fire("Error", "Login Gagal: " + msg, "error");
    }
});

// Logout
function logoutUser() {
    auth.signOut();
    window.location.reload();
}

// --- NAVIGASI UI ---
function hideAllPages() {
    document.getElementById('adminDashboard').classList.add('d-none');
    document.getElementById('parentDashboard').classList.add('d-none');
    document.getElementById('profileSection').classList.add('d-none');
}

async function showPage(page) {
    window.currentPage = page;
    hideAllPages();

    const filterArea = document.getElementById('filterArea');
    if (filterArea) {
        filterArea.classList.remove('show-filter');
        if (page === 'home' && (currentRole === 'superadmin' || currentRole === 'admin')) {
            filterArea.style.setProperty('display', 'block', 'important');
        } else {
            // PAKSA SEMBUNYI di profil atau halaman lainnya
            filterArea.style.setProperty('display', 'none', 'important');
        }
    }

    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    // --- TAMBAHAN: Efek Smooth Scroll ke Atas ---
    window.scrollTo({ top: 0, behavior: 'smooth' });

    
    // --- 1. LOGIKA LONCENG (Tetap Sesuai Kode Kakak) ---
    const notifArea = document.getElementById('notifArea');
    if (notifArea) {
        if (currentRole === 'superadmin') { 
            // Saya tambahkan 'parent' agar wali juga bisa lihat lonceng jika ada notif
            notifArea.classList.remove('d-none');
        } else {
            notifArea.classList.add('d-none');
        }
    }

    // --- 2. PANGGIL SAPAAN DISINI ---
    // Kita panggil fungsi greeting setiap kali halaman 'home', 'admin', atau 'parent' dibuka
    if (page === 'home' || page === 'admin' || page === 'parent') {
        let nameToDisplay = "";

        if (currentRole === 'superadmin' || currentRole === 'admin') {
            // Jika variabel window.userName belum ada isinya, beri default "Pengajar"
            nameToDisplay = window.userName || "Pengajar"; 
        } else if (currentRole === 'parent') {
            // Mengambil nama Wali yang login
            nameToDisplay = window.parentName || "Wali Santri";
        }

        displayGreeting(nameToDisplay);
    }

    // --- 2. NAVIGASI HALAMAN ---
    if (page === 'home') {
        if (currentRole === 'admin' || currentRole === 'superadmin') {
            document.getElementById('adminDashboard').classList.remove('d-none');
        } else {
            document.getElementById('parentDashboard').classList.remove('d-none');
        }
    } else if (page === 'admin') {
        document.getElementById('adminDashboard').classList.remove('d-none');
    } else if (page === 'parent') {
        document.getElementById('parentDashboard').classList.remove('d-none');
    } else if (page === 'profile') {
        document.getElementById('profileSection').classList.remove('d-none');
        
        // --- 3. LOGIKA DINAMIS PROFIL (SOLUSI AGAR TIDAK BERCAMPUR) ---
        if (currentRole === 'parent') {
            // Jika Wali yang buka profil: Munculkan Kartu Santri & Sembunyikan Foto Biasa
            const snap = await db.collection('students').where('parentEmail', '==', currentUser.email).limit(1).get();
            if (!snap.empty) {
                const studentData = snap.docs[0].data();
                const studentId = snap.docs[0].id;
                
                // Jalankan fungsi pengatur tampilan yang kita buat tadi
                setupProfilePage('parent', studentData, studentId);
            }
        } else {
            // Jika Ustadzah yang buka profil: Sembunyikan Kartu Santri & Munculkan Foto Biasa
            const adminDoc = await db.collection('users').doc(currentUser.uid).get();
            if (adminDoc.exists) {
                setupProfilePage('admin', adminDoc.data());
            }
        }
    }
}

let filterTimeout;

// Fungsi untuk Memunculkan Filter
function triggerFilter() {
    const filterArea = document.getElementById('filterArea');
  const isNavbar = e.target.closest('.navbar'); 
    if (isNavbar) return;
    if (window.currentPage === 'home' && (currentRole === 'admin' || currentRole === 'superadmin')) {
        if (filterArea) {
            filterArea.classList.add('show-filter');

            // Hapus timer lama
            clearTimeout(filterTimeout);

            // Sembunyikan lagi setelah 2 detik diam
            filterTimeout = setTimeout(() => {
                filterArea.classList.remove('show-filter');
            }, 2000);
        }
    }
}

// Deteksi Scroll
window.addEventListener('scroll', triggerFilter);

// Deteksi Sentuhan Layar (Untuk HP agar lebih responsif)
window.addEventListener('touchmove', triggerFilter);

// --- 4. FUNGSI PEMBANTU (PASTIKAN KODE INI ADA DI SCRIPT.JS) ---
function setupProfilePage(role, userData, studentId = null) {
    const cardContainer = document.getElementById('dynamicProfileCard');
    const areaPhoto = document.getElementById('areaPhotoProfil');
    const labelNama = document.getElementById('labelNamaProfil');
    const inputNamaSantri = document.getElementById('profilNama');
    const inputNamaWali = document.getElementById('profilNamaWali');
    const groupNamaWali = document.getElementById('groupNamaWali');

    if (role === 'parent') {
        // --- TAMPILAN WALI SANTRI ---
        areaPhoto.classList.add('d-none'); // Sembunyikan upload foto admin
        groupNamaWali.classList.remove('d-none');
        labelNama.innerText = "Nama Santri";
        
        inputNamaSantri.readOnly = true;
        inputNamaSantri.style.backgroundColor = "#e9ecef";
        inputNamaSantri.value = userData.name || "";
        inputNamaWali.value = userData.parentName || "";

// 1. Ambil data jilid asli
// Gunakan .replace untuk menghapus kata "Jilid " agar parseInt hanya mengambil angkanya saja
// --- PASTIKAN BLOK INI BERADA DI DALAM onSnapshot ---
db.collection('students').doc(studentId).onSnapshot((doc) => {
    const userData = doc.data();
    if (!userData) return;

    // 1. Ambil data jilid asli & bersihkan kata "Jilid "
    let jilidRaw = userData.jilid || "Jilid PAUD";
    let jilidClean = jilidRaw.replace("Jilid ", ""); 

    // 2. Tentukan angka untuk perhitungan progress bar
    let numericJilid;
    if (jilidClean === "PAUD") {
        numericJilid = 0.5; // Agar bar muncul sedikit (sekitar 8%)
    } else if (jilidClean === "Al-Quran" || jilidClean === "Al-Qur'an") {
        numericJilid = 6;   // Full 100%
    } else {
        // Mengambil angka dari "1", "2", dst
        numericJilid = parseInt(jilidClean) || 0;
    }

    // Perhitungan Progres: (posisi / total jilid) * 100
    const progress = Math.min((numericJilid / 6) * 100, 100);

    // Logika Label Jilid agar tidak dobel kata "Jilid"
    const displayJilid = (jilidRaw.includes("Jilid") || jilidRaw.includes("Al-Qur")) 
                        ? jilidRaw 
                        : " " + jilidRaw;

    const avatar = userData.gender === 'Perempuan' ? 'https://i.imgur.com/NcNQ9R3.jpeg' : 'https://i.imgur.com/HPPr16Q.jpeg';

    // Masukkan HTML Kartu ke Container (Menggunakan "=" agar me-reset isi setiap update data)
    cardContainer.innerHTML = `
    <div class="card shadow-sm mb-4 border-0 card-santri-dynamic" style="border-radius: 15px; border-left: 5px solid #28a745;">
        <div class="card-body p-4 text-start">
            <div class="row align-items-center">
                <div class="col-4 text-center">
                    <img src="${userData.photo || avatar}" class="rounded-circle shadow-sm" style="width: 85px; height: 85px; object-fit: cover; border: 3px solid #198754;">
                    <div class="mt-2">
                        <small class="text-card-muted d-block" style="font-size: 0.6rem; font-weight: bold;">NIS: ${userData.nis || '-'}</small>
                    </div>
                </div>
                <div class="col-5">
                    <h5 class="fw-bold mb-0 text-card-title">${userData.name}</h5>
                    <small class="text-success fw-bold d-block mb-2">Otw Al-Qur'an! 📖</small>
                    <div class="progress custom-progress" style="height: 8px; border-radius: 10px;">
                        <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                             style="width: ${progress}%">
                        </div>
                    </div>
                    <div class="d-flex justify-content-between mt-1 small text-card-muted" style="font-size: 0.7rem;">
                        <span>${displayJilid}</span>
                        <span>Al-Qur'an</span>
                    </div>
                </div>
                <div class="col-3 text-center">
                    <div id="qrcode" class="qrcode-wrapper p-1 d-inline-block shadow-sm" style="border-radius: 8px;"></div>
                </div>
            </div>
        </div>
    </div>`;

    // Re-generate QR Code setelah HTML kartu diupdate (jika menggunakan library qrcode)
    if (typeof generateQRCode === "function") {
        generateQRCode(userData.nis || userData.name);
    }
});

// 2. JALANKAN INI SETELAH innerHTML (Penting agar QR Code Ter-render)
setTimeout(() => {
    const qrcodeContainer = document.getElementById("qrcode");
    if (qrcodeContainer && userData.nis) {
        qrcodeContainer.innerHTML = ""; // Bersihkan sisa QR lama agar tidak tumpang tindih

        let baseURL = window.location.origin;

        if (baseURL.includes("github.io")) {
            baseURL = "tpqalmubarokarc.blogspot.com"; 
        }
        
        // LOGIKA OTOMATIS: 
        // Menggunakan window.location.origin agar saat di lokal link-nya localhost, 
        // dan saat di deploy link-nya otomatis netlify.app
        const blogspotURL = "https://tpqalmubarokarc.blogspot.com"; // Ganti dengan domain blogspot Kakak
        const finalLink = `${blogspotURL}/p/kartu-santri.html?nis=${userData.nis}`;

        new QRCode(qrcodeContainer, {
            text: finalLink,
            width: 60,
            height: 60,
            colorDark : "#198754",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });

        console.log("QR Code Generated for:", finalLink);
    }
}, 200); // Jeda dinaikkan sedikit (200ms) agar lebih stabil di HP yang agak lambat
    } else {
        // --- TAMPILAN USTADZAH ---
        cardContainer.innerHTML = "";
        areaPhoto.classList.remove('d-none');
        groupNamaWali.classList.add('d-none');
        labelNama.innerText = "Nama Lengkap Ustadzah";
        
        inputNamaSantri.readOnly = false;
        inputNamaSantri.style.backgroundColor = "#ffffff";
        inputNamaSantri.value = userData.nama || userData.name || "";
        
        const imgPreview = document.getElementById('profilePreview');
        if (imgPreview) {
            // LOGIKA BARU:
            // 1. Cek di Firestore (gambar Kakak membuktikan ini kosong/tidak ada)
            // 2. Cek di Firebase Auth (currentUser.photoURL)
            // 3. Kalau dua-duanya gak ada, baru inisial
            const linkFoto = userData.photoURL || currentUser.photoURL || `https://ui-avatars.com/api/?name=${userData.nama || 'U'}`;
            
            imgPreview.src = linkFoto;
            imgPreview.style.objectFit = "cover";
        }
    }   

    // --- DATA INI HARUS DI LUAR ELSE AGAR TERISI UNTUK SEMUA ROLE ---
    if(document.getElementById('profilEmail')) document.getElementById('profilEmail').value = currentUser.email || "";
    if(document.getElementById('profilePhone')) document.getElementById('profilePhone').value = userData.phone || "";
    if(document.getElementById('profileAddress')) document.getElementById('profileAddress').value = userData.address || "";
}   

// --- FITUR ADMIN (USTADZAH) ---

/// 1. Simpan Data Santri (Create/Update)
async function saveStudent() {
    const id = document.getElementById('studentId').value;
    const name = document.getElementById('stdName').value;
    const gender = document.getElementById('stdGender').value;
    const sClass = document.getElementById('stdClass').value;
    const jilid = document.getElementById('stdJilid').value;
    const parentEmail = document.getElementById('stdParentEmail').value;
    const parentPhone = document.getElementById('stdParentPhone').value;
    const photoFile = document.getElementById('stdPhoto').files[0];
    const joinDateValue = document.getElementById('stdJoinDate').value;

    let teacher = "";
    if (sClass === "TK-SD (Sunan Giri)") {
        teacher = "Ustadzah Salwa";
    } else if (sClass === "Pra-TK (Sunan Ampel)" || sClass === "TK-SD (Sunan Kalijaga)") {
        teacher = "Ustadzah Fika";
    } 

    if (!joinDateValue && !id) {
        Swal.fire("Peringatan", "Silakan isi tanggal aktif santri terlebih dahulu!", "warning");
        return;
    }

    let photoUrl = "";

    try {
        if (photoFile) {
            const storageRef = storage.ref(`students/${new Date().getTime()}_${photoFile.name}`);
            await storageRef.put(photoFile);
            photoUrl = await storageRef.getDownloadURL();
        }

        const studentData = {
            name, gender, class: sClass, jilid, teacher, // teacher sudah otomatis
            parentEmail, parentPhone,
            joinDate: joinDateValue,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (photoUrl) studentData.photo = photoUrl;

        if (id) {
            // JIKA UPDATE: Jangan buat NIS baru agar tetap permanen
            await db.collection('students').doc(id).update(studentData);
        } else {
            // JIKA DATA BARU: Generate NIS otomatis berdasarkan Tanggal Aktif
            const selectedDate = new Date(joinDateValue);
            const tahun = selectedDate.getFullYear();
            const tanggal = String(selectedDate.getDate()).padStart(2, '0');
            const bulan = String(selectedDate.getMonth() + 1).padStart(2, '0');
            
            // Ambil nomor urut berdasarkan jumlah santri saat ini
            const snapshot = await db.collection('students').get();
            const urutan = String(snapshot.size + 1).padStart(2, '0');
            
            // Format NIS sesuai permintaan: Tahun + Tanggal + Bulan + Urutan
            studentData.nis = `${tahun}${tanggal}${bulan}${urutan}`;
            studentData.grades = {}; 
            studentData.infaqStatus = false;
            studentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

            await db.collection('students').add(studentData);
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
        modal.hide();
        renderStudents();
        document.getElementById('studentForm').reset();
        
    } catch (error) {
        Swal.fire("Error", "Error: " + error.message, "error");
    }
    document.getElementById('loading').classList.add('d-none');
}

// 2. Render Daftar Santri
function renderStudents() { 
    const listDiv = document.getElementById('studentList');
    const notifList = document.getElementById('notifList'); 
    const notifCount = document.getElementById('notifCount'); 
    
    const filter = document.getElementById('filterClass').value;
    let query = db.collection('students');
    if (filter !== 'all') query = query.where('class', '==', filter);

    query = query.orderBy('name', 'asc');

    query.onSnapshot((snapshot) => {
        listDiv.innerHTML = '';
        if (notifList) notifList.innerHTML = ''; 
        let pendingCount = 0;

        const totalSantriElement = document.getElementById('totalSantriCount');
        if (totalSantriElement) {
            totalSantriElement.innerText = snapshot.size; 
        } 

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            const avatarLaki = 'https://i.imgur.com/HPPr16Q.jpeg';
            const avatarPerempuan = 'https://i.imgur.com/NcNQ9R3.jpeg';
            const defaultAvatar = data.gender === 'Perempuan' ? avatarPerempuan : avatarLaki;

// --- 1. LOGIKA NOTIFIKASI TERPISAH (SISI LONCENG) ---
if (currentRole === 'superadmin' && notifList) {
    // A. Notifikasi Infaq
    if (data.paymentMethod && !data.infaqStatus) {
        pendingCount++;
        notifList.innerHTML += `
            <div class="list-group-item p-2 border-bottom bg-light" style="cursor: pointer;" onclick="tandaiDibaca('${id}', 'infaq', '${data.name}')">
                <div class="d-flex justify-content-between align-items-center">
                    <div style="font-size: 0.75rem;">
                        <span class="badge bg-warning text-dark mb-1">Infaq Baru</span><br>
                        <strong>${data.name}</strong> - ${data.paymentMethod}
                    </div>
                </div>
            </div>`;
    }
    
    // B. Notifikasi TTD Rapor
    if (data.reportSignature && !data.ttdNotifRead) {
    pendingCount++; 
    notifList.innerHTML += `
        <div class="list-group-item p-2 border-bottom" style="cursor: pointer;" 
             onclick="tandaiDibaca('${id}', 'signature', '${data.name}')">
            <div class="d-flex align-items-center">
                <div class="me-2 text-info"><i class="fas fa-file-signature fa-lg"></i></div>
                <div style="font-size: 0.75rem;">
                    <span class="badge bg-info text-white mb-1">TTD Wali Baru</span><br>
                    <strong>Wali dari ${data.name}</strong><br>
                    <span class="text-muted" style="font-size: 0.65rem;">Klik untuk verifikasi TTD</span>
                </div>
            </div>
        </div>`;
    }
}

            // --- 2. LOGIKA BADGE DI KARTU (TETAP SAMA) ---
            let statusBadgeHtml = "";
            if (currentRole === 'superadmin') {
                if (data.infaqStatus === true) {
                    statusBadgeHtml = `
                        <div class="d-flex flex-column gap-1">
                            <span class="badge bg-success w-100 py-2">Sudah Lunas</span>
                            <button class="btn btn-xs btn-outline-danger w-100 py-1" style="font-size: 0.65rem;" 
                                    onclick="event.stopPropagation(); batalkanVerifikasi('${id}', '${data.name}')">
                                <i class="fas fa-undo"></i> Reset
                            </button>
                        </div>`;
                } else {
                    statusBadgeHtml = `<span class="badge bg-light text-muted w-100 py-2 border">Belum Bayar</span>`;
                }
            }

            let walletBadgeHtml = "";
            let ttdStatusHtml = ""; 
if (currentRole === 'superadmin') {
    if (data.reportSignature) {
        ttdStatusHtml = `
            <div class="mb-2">
                <span class="badge bg-info text-dark w-100 py-1" style="font-size: 0.6rem;">
                    <i class="fas fa-check-circle"></i> Rapor Diterima
                </span>
                <button class="btn btn-xs btn-outline-secondary w-100 mt-1" 
                        style="font-size: 0.55rem; padding: 2px;" 
                        onclick="event.stopPropagation(); resetTTD('${id}', '${data.name}')">
                    <i class="fas fa-eraser"></i> Reset TTD
                </button>
            </div>`;
    } else {
        ttdStatusHtml = `<div class="mb-2"><span class="badge bg-light text-muted w-100 py-1 border" style="font-size: 0.6rem;">Belum TTD</span></div>`;
    }
}

            const cardHtml = `
                <div class="col-6 col-md-4 col-lg-3 santri-card">
                    <div class="card card-student shadow-sm h-100 position-relative">
                        <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" 
                                onclick="event.stopPropagation(); deleteStudent('${id}', '${data.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <img src="${data.photo || defaultAvatar}" class="student-img-top" onclick="openDetail('${id}')">
                        <div class="card-body p-2 text-center">
                            <h6 class="card-title fw-bold mb-1 nama-santri">${data.name}</h6>
                            <small class="text-muted d-block mb-1">${data.class}</small>
                            ${ttdStatusHtml}
                            ${walletBadgeHtml}
                            ${statusBadgeHtml}
                        </div>
                    </div>
                </div>`;
            listDiv.innerHTML += cardHtml;
        });

        // --- UPDATE LONCENG & HIDE LOADER ---
        if (notifCount) {
            notifCount.innerText = pendingCount;
            
            if (pendingCount > 0) {
                // Tampilkan angka badge
                notifCount.classList.remove('d-none');
                
                // --- PAKSA ANIMASI PULSE MENYALA ---
                // Kita hapus dulu class-nya, lalu pasang lagi agar browser men-trigger animasi dari awal
                notifCount.classList.remove('notif-pulse');
                void notifCount.offsetWidth; // Trik "Reflow" agar animasi me-reset
                notifCount.classList.add('notif-pulse');
                
                // Update Judul Dropdown secara otomatis
                const notifHeader = document.getElementById('notifHeader');
                if (notifHeader) notifHeader.innerText = "Pemberitahuan Baru";
                
                // Pastikan area lonceng terlihat
                const notifArea = document.getElementById('notifArea');
                if (notifArea) notifArea.classList.remove('d-none');
            } else {
                // Jika tidak ada notif, sembunyikan angka dan matikan animasi
                notifCount.classList.add('d-none');
                notifCount.classList.remove('notif-pulse');
                
                const notifHeader = document.getElementById('notifHeader');
                if (notifHeader) notifHeader.innerText = "Tidak ada Notifikasi";
            }
        }
        
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('d-none');

    }, (error) => {
        console.error("Error:", error);
        if (document.getElementById('loader')) document.getElementById('loader').classList.add('d-none');
    });
}
// 3. Buka Detail & Input Nilai
async function openDetail(id) {
    const modal = new bootstrap.Modal(document.getElementById('gradeModal'));
    modal.show();
    document.getElementById('loading').classList.add('d-none');
    const doc = await db.collection('students').doc(id).get();
    const data = doc.data();
    
    document.getElementById('gradeStudentId').value = id;
    document.getElementById('gradeNotes').value = data.notes || '';
    
    const formContainer = document.getElementById('gradeFormContainer');
    formContainer.innerHTML = `
    <div class="d-flex align-items-center mb-4 p-2 bg-light rounded-3 shadow-sm border border-success border-opacity-25">
        <div class="position-relative">
            <img id="detailFotoSantri" src="${data.photo || (data.gender === 'Perempuan' ? 'https://i.imgur.com/NcNQ9R3.jpeg' : 'https://i.imgur.com/HPPr16Q.jpeg')}" 
                 class="rounded-circle border border-2 border-white shadow-sm"
                 style="width: 65px; height: 65px; object-fit: cover; cursor: ${currentRole === 'superadmin' ? 'pointer' : 'default'};"
                 onclick="${currentRole === 'superadmin' ? "document.getElementById('inputFotoSantri').click()" : ""}">
            
            ${currentRole === 'superadmin' ? '<div class="position-absolute bottom-0 end-0 bg-success text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style="width: 22px; height: 22px; border: 2px solid white;"><i class="fas fa-camera" style="font-size: 10px;"></i></div>' : ''}
        </div>
        <div class="ms-3">
            <h5 class="mb-0 fw-bold text-success">${data.name}</h5>
            <small class="text-muted fw-bold">${data.class}</small>
            <div class="text-muted" style="font-size: 0.75rem;">Guru: ${data.teacher}</div>
        </div>
    </div>

    <div class="mb-4 p-3 bg-light rounded border">
        <label class="form-label small fw-bold text-success"><i class="fas fa-envelope me-1"></i> Email Login Wali Santri</label>
        <input type="email" id="updateParentEmail" class="form-control form-control-sm" 
               value="${data.parentEmail || ''}" placeholder="Masukkan email asli wali santri">
        <div class="form-text" style="font-size: 0.65rem;">Ganti email asli jika sudah ada</div>
    </div>

    <hr>
    
    <h6 class="fw-bold mb-3">Daftar Kehadiran Santri:</h6>
    <div class="row g-2 mb-4">
        <div class="col-4 text-center">
            <label class="form-label small fw-bold text-danger">Sakit</label>
            <input type="number" id="absensiSakit" class="form-control form-control-sm text-center" 
                   value="${data.absensiSakit || 0}" min="0">
        </div>
        <div class="col-4 text-center">
            <label class="form-label small fw-bold text-warning">Izin</label>
            <input type="number" id="absensiIzin" class="form-control form-control-sm text-center" 
                   value="${data.absensiIzin || 0}" min="0">
        </div>
        <div class="col-4 text-center">
            <label class="form-label small fw-bold text-secondary">Lain-lain</label>
            <input type="number" id="absensiLain" class="form-control form-control-sm text-center" 
                   value="${data.absensiLain || 0}" min="0">
        </div>
    </div>

    <hr>
    <h6 class="fw-bold mb-3">Input Nilai Rapor:</h6>
`;

    let subjects = data.class.includes("Pra-TK") 
        ? ["Jilid", "Akidah Akhlak", "Kitabaty"] 
        : ["Jilid", "Bacaan Shalat", "Surat Pilihan", "Hadits Pilihan", "Aqidah Akhlak", "Kitabaty"];

    const savedGrades = data.grades || {};

    subjects.forEach(subj => {
        const val = savedGrades[subj] || '';
        formContainer.innerHTML += `
            <div class="row mb-2 align-items-center">
                <div class="col-6"><label>${subj}</label></div>
                <div class="col-6">
                    <select class="form-select form-select-sm grade-input" data-subject="${subj}">
                        <option value="">-</option>
                        <option value="A+" ${val==='A+'?'selected':''}>A+</option>
                        <option value="A" ${val==='A'?'selected':''}>A</option>
                        <option value="B+" ${val==='B+'?'selected':''}>B+</option>
                        <option value="B" ${val==='B'?'selected':''}>B</option>
                        <option value="C+" ${val==='C+'?'selected':''}>C+</option>
                        <option value="C" ${val==='C'?'selected':''}>C</option>
                    </select>
                </div>
            </div>
        `;
    });

    // Proteksi Tombol Tagihan WA: Hanya muncul jika Superadmin
    const modalFooter = document.querySelector('#gradeModal .modal-body .d-flex.gap-2');
    if (modalFooter) {
        const billingBtn = (currentRole === 'superadmin') 
            ? `<button class="btn btn-warning flex-grow-1" onclick="sendBillWA()">Tagih Infaq (WA)</button>` 
            : '';
        modalFooter.innerHTML = `
            <button class="btn btn-success flex-grow-1" onclick="saveGrades()">Simpan</button>
            ${billingBtn}
        `;
    }

    
}
    
// 4. Simpan Nilai
async function saveGrades() {
    const id = document.getElementById('gradeStudentId').value;
    const inputs = document.querySelectorAll('.grade-input');
    const notes = document.getElementById('gradeNotes').value;
    const levelValue = document.getElementById('studentLevel').value;
    
    // --- AMBIL NILAI ABSENSI DARI INPUT ---
    // Pastikan ID input di HTML Kakak sesuai (contoh: absensiSakit, absensiIzin, absensiLain)
    const sakit = document.getElementById('absensiSakit').value || 0;
    const izin = document.getElementById('absensiIzin').value || 0;
    const lain = document.getElementById('absensiLain').value || 0;
    
    let gradesObj = {};
    inputs.forEach(input => {
        gradesObj[input.dataset.subject] = input.value;
    });

    // --- UPDATE DATABASE ---
    await db.collection('students').doc(id).update({
        grades: gradesObj,
        notes: notes,
        jilid: levelValue,
        // Tambahkan field ini agar tersimpan di database:
        absensiSakit: parseInt(sakit),
        absensiIzin: parseInt(izin),
        absensiLain: parseInt(lain)
    });
    
    Swal.fire("Berhasil", "Nilai, Jilid, dan Absensi berhasil disimpan!", "success");
    const modal = bootstrap.Modal.getInstance(document.getElementById('gradeModal'));
    modal.hide();
}

// 5. Tagihan WA (Individual)
async function sendBillWA() {
    if (currentRole !== 'superadmin') {
        Swal.fire("Peringatan", "Hanya Superadmin yang dapat mengirim tagihan.", "warning");
        return;
    }
    
    const id = document.getElementById('gradeStudentId').value;
    const doc = await db.collection('students').doc(id).get();
    const data = doc.data();

    if (!data.parentPhone) {
        Swal.fire("Peringatan", "Nomor WhatsApp wali belum diisi.", "warning");
        return;
    }

    // Link Portal Kakak
    const linkPortal = "https://tpqalmubarokarc.blogspot.com/p/portal-si-barok.html";

    // Pesan dengan Edukasi Login
    const message = `*Assalamu'alaikum Warahmatullahi Wabarakatuh*\n\n` +
        `Ayah/Bunda dari Ananda *${data.name}*,\n` +
        `Semoga senantiasa dalam keadaan sehat dan penuh keberkahan.\n\n` +
        `Kami informasikan terkait administrasi *Infaq Bulanan* periode ini sebesar *Rp 100.000*.\n\n` +
        `Untuk kemudahan Bapak/Ibu, detail tagihan dan metode pembayaran dapat diakses melalui *Portal SI-BAROK* pada link berikut:\n` +
        `${linkPortal}\n\n` +
        `*Cara Akses Portal:*\n` +
        `1. Klik link di atas.\n` +
        `2. Masukkan *Email* dan *Password* yang telah didaftarkan.\n` +
        `3. Pilih menu Tagihan/Infaq untuk melakukan pembayaran.\n\n` +
        `Kontribusi Ayah/Bunda sangat berarti bagi pendidikan Al-Qur'an santri di TPQ Al-Mubarok. Jazakumullah Khairan Katsiran.\n\n` +
        `*Admin TPQ Al-Mubarok*`;

    // Format nomor WhatsApp (Hapus karakter non-angka dan ubah 0 ke 62)
    let phone = data.parentPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

// --- FITUR WALI SANTRI ---
async function loadChildData(email) {
    const loader = document.getElementById('loading');
    
    // 1. ANTENA REAL-TIME: Nilai Rapor, Infaq, Foto, dan Profil
    db.collection('students').where('parentEmail', '==', email).limit(1)
        .onSnapshot((snapshot) => {
            // MATIKAN LOADER SEGERA SAAT DATA TIBA (Menghilangkan stuck "Memuat")
            if (loader) loader.classList.add('d-none');

            if (snapshot.empty) {
                const dashboard = document.getElementById('parentDashboard');
                if(dashboard) dashboard.innerHTML = '<div class="alert alert-warning">Data santri tidak ditemukan.</div>';
                return;
            }

            const docSnap = snapshot.docs[0];
            const data = docSnap.data();
            const studentId = docSnap.id; 
            
            const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            const tanggalSekarang = new Date();
            const namaBulan = daftarBulan[tanggalSekarang.getMonth()];
            const tahunSekarang = tanggalSekarang.getFullYear();

            const displayBulan = document.getElementById('currentMonthDisplay');
            if (displayBulan) {
                displayBulan.innerText = "Bulan " + namaBulan + " " + tahunSekarang;
            }

            // --- A. Sinkronisasi Foto & Profil ---
const fotoSantri = data.photo || (data.gender === 'Perempuan' ? 'https://i.imgur.com/NcNQ9R3.jpeg' : 'https://i.imgur.com/HPPr16Q.jpeg');

if (document.getElementById('childPhotoDisplay')) document.getElementById('childPhotoDisplay').src = fotoSantri;
if (document.getElementById('childNameDisplay')) document.getElementById('childNameDisplay').innerText = data.name || "-";
if (document.getElementById('childClassDisplay')) document.getElementById('childClassDisplay').innerText = data.class || "-";

let teksJilid = (data.jilid || "-").toString().replace("Jilid ", "");
if (document.getElementById('childJilidDisplay')) {
    document.getElementById('childJilidDisplay').innerText = "Jilid " + teksJilid;
}

// --- B. Sinkronisasi Nilai, Absensi, & TTD ---
const reportDiv = document.getElementById('childReportCard');
if (reportDiv) {
    let contentHtml = ''; // Variabel ini harus menampung SEMUANYA

    // 1. Tambah Nilai
    if (data.grades) {
        for (const [subj, grade] of Object.entries(data.grades)) {
            contentHtml += `
                <div class="grade-row d-flex justify-content-between border-bottom py-2">
                    <span>${subj}</span>
                    <span class="badge bg-primary badge-grade">${grade}</span>
                </div>`;
        }
    }

    // 2. Tambah Absensi (Sesuai keinginan Kakak)
    contentHtml += `
        <div class="mt-4 mb-2" style="margin-left: -1rem; margin-right: -1rem;"> 
            <div class="py-2 px-3 bg-secondary bg-opacity-25 border-top border-bottom border-secondary border-opacity-25">
                <h6 class="fw-bold mb-0 text-uppercase" style="font-size: 0.75rem; letter-spacing: 1px;">
                    Kehadiran Santri
                </h6>
            </div>
        </div>`;

    contentHtml += `
        <div class="grade-row d-flex justify-content-between border-bottom py-2">
            <span>Sakit</span>
            <span class="badge bg-danger">${data.absensiSakit || 0}</span>
        </div>
        <div class="grade-row d-flex justify-content-between border-bottom py-2">
            <span>Izin</span>
            <span class="badge bg-warning text-dark">${data.absensiIzin || 0}</span>
        </div>
        <div class="grade-row d-flex justify-content-between border-bottom py-2">
            <span>Lain-lain</span>
            <span class="badge bg-secondary">${data.absensiLain || 0}</span>
        </div>`;

    // 3. Logika Wali Kelas
    let namaWaliKelas = "Hafi Dzotur Rofi'ah, Lc.";
    let linkTtdWaliKelas = "https://i.imgur.com/APp2Mt6.png";
    const kelasSantri = data.class || "";

    if (kelasSantri.includes("Sunan Giri")) {
        namaWaliKelas = "Salwa Kamilatuz Zakiyah";
        linkTtdWaliKelas = "https://i.imgur.com/pOg9hxn.png";
    }

    const tglSekarang = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    // 4. Tambah Bagian TTD (Digabung ke contentHtml)
    contentHtml += `
    <div id="signatureWrapper" class="mt-4">
        <div class="row text-center align-items-start g-0">
            <div class="col-4">
                <p class="small mb-0" style="font-size: 0.7rem;">Mengetahui,</p>
                <p class="small fw-bold mb-2" style="font-size: 0.75rem;">Kepala TPQ</p>
                <div style="min-height: 50px;" class="d-flex align-items-center justify-content-center">
                    <img src="https://i.imgur.com/APp2Mt6.png" style="max-height: 45px; width: auto;">
                </div>
                <p class="small fw-bold mb-0" style="text-decoration: underline; font-size: 0.65rem;">Hafi Dzotur Rofi'ah, Lc.</p>
            </div>
            <div class="col-4">
                <p class="small mb-0">&nbsp;</p>
                <p class="small fw-bold mb-2" style="font-size: 0.75rem;">Wali Kelas</p>
                <div style="min-height: 50px;" class="d-flex align-items-center justify-content-center">
                    <img src="${linkTtdWaliKelas}" style="max-height: 45px; width: auto;">
                </div>
                <p class="small fw-bold mb-0" style="text-decoration: underline; font-size: 0.65rem;">${namaWaliKelas}</p>
            </div>
            <div class="col-4">
                <p class="small mb-1" style="font-size: 0.6rem;">Sidoarjo, ${tglSekarang}</p>
                <p class="small fw-bold mb-2" style="font-size: 0.75rem;">Wali Santri,</p>
                <div id="boxSignatureResult" style="min-height: 50px;" class="d-flex align-items-center justify-content-center">
                    ${data.reportSignature ? `<img src="${data.reportSignature}" style="max-height: 45px; width: auto;">` : `<span style="font-size: 8px; color: #ccc;">(Belum TTD)</span>`}
                </div>
                <p class="small fw-bold mb-0" style="font-size: 0.65rem; text-decoration: underline;">${data.parentName || "( Nama Wali Santri )"}</p>
            </div>
        </div>
    </div>
    <div id="signatureInputArea"></div>`;

    // 5. Masukkan SEMUA ke dalam HTML sekaligus
    reportDiv.innerHTML = contentHtml;

    // 6. Jalankan fungsi TTD
    if (typeof checkSignatureStatus === 'function') {
        checkSignatureStatus(docSnap.id, data);
    }
}

// --- AKHIR ---
const ldr = document.getElementById('loading');
if (ldr) ldr.classList.add('d-none');
            // --- C. Sinkronisasi Status Infaq Otomatis ---
            const statusText = document.getElementById('childInfaqStatus');
            const btnCetak = document.getElementById('btnCetakKuitansi');
            const cardInfaq = document.getElementById('cardInfaq'); // ID Baru yang ditambahkan di HTML
            
            if (data.infaqStatus === true || data.infaqStatus === "Lunas") {
                // Tampilan Lunas
                statusText.innerText = "Lunas";
                statusText.className = "text-success fw-bold";
                if(btnCetak) btnCetak.classList.remove('d-none');
                
                // Ganti Border ke Hijau
                if(cardInfaq) {
                    cardInfaq.classList.remove('border-danger');
                    cardInfaq.classList.add('border-success');
                }
            } else {
                // Tampilan Belum Lunas
                statusText.innerText = "Belum Lunas";
                statusText.className = "text-danger fw-bold";
                if(btnCetak) btnCetak.classList.add('d-none');
                
                // Ganti Border ke Merah
                if(cardInfaq) {
                    cardInfaq.classList.remove('border-success');
                    cardInfaq.classList.add('border-danger');
                }
            }   

            // --- D. UPDATE OTOMATIS: Riwayat Pembayaran ---
            loadPaymentHistory(studentId);

            if (typeof playBeep === 'function') playBeep();
        }, (error) => {
            console.error("Error Snapshot:", error);
            if (loader) loader.classList.add('d-none');
        });

    // 2. ANTENA REAL-TIME: Notifikasi Lonceng
    db.collection('notifications')
        .where('parentEmail', '==', email)
        .orderBy('timestamp', 'desc')
        .limit(5)
        .onSnapshot((notifSnapshot) => {
            const notifCount = document.getElementById('notifCount');
            const notifList = document.getElementById('notifList');
            
            if (!notifSnapshot.empty) {
                if(notifCount) {
                    notifCount.innerText = notifSnapshot.size;
                    notifCount.classList.remove('d-none');
                }
                if(notifList) {
                    notifList.innerHTML = '';
                    notifSnapshot.forEach(doc => {
                        const n = doc.data();
                        notifList.innerHTML += `
                            <div class="list-group-item p-2 small">
                                <b class="text-primary">${n.title || 'Info'}</b><br>${n.message}
                            </div>`;
                    });
                }
            }
        });
}

// --- SINKRONISASI TANDA TANGAN ---
const tglDisplay = document.getElementById('tglTTDDisplay');
if (tglDisplay) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    tglDisplay.innerText = "Sidoarjo, " + new Date().toLocaleDateString('id-ID', options);
}

// Logika Tampilan TTD
if (typeof data !== 'undefined' && data) {
    if (data.reportSignature) {
        // Jika sudah ada TTD di database
        const boxInput = document.getElementById('boxInputTTD');
        const boxHasil = document.getElementById('boxHasilTTD');
        const imgHasil = document.getElementById('imgHasilTTD');
        const labelNama = document.getElementById('labelNamaWali');

        if (boxInput) boxInput.classList.add('d-none');
        if (boxHasil) boxHasil.classList.remove('d-none');
        if (imgHasil) imgHasil.src = data.reportSignature;
        if (labelNama) labelNama.innerText = data.parentName || "Sudah Dicek Wali";
    } else {
        // Jika belum TTD, aktifkan pad
        const boxInput = document.getElementById('boxInputTTD');
        const boxHasil = document.getElementById('boxHasilTTD');
        
        if (boxInput) boxInput.classList.remove('d-none');
        if (boxHasil) boxHasil.classList.add('d-none');
        
        // Memastikan fungsi init dan ID dokumen tersedia agar tidak stuck
        if (typeof initSignaturePad === 'function') {
            const idDoc = (typeof docSnap !== 'undefined') ? docSnap.id : (typeof doc !== 'undefined' ? doc.id : null);
            if (idDoc) {
                initSignaturePad(idDoc, data.name || "");
            }
        }
    }
}

// Fungsi Pendukung Riwayat Pembayaran
async function loadPaymentHistory(studentId) {
    const historyList = document.getElementById('paymentHistoryList');
    if (!historyList) return;

    try {
        const snapshot = await db.collection('students').doc(studentId).collection('payments').orderBy('date', 'desc').get();
        
        // Memastikan ada jarak bawah yang konsisten
        historyList.classList.add('mb-4');

        if (snapshot.empty) {
            historyList.innerHTML = `
                <div class="list-group-item border rounded p-4 text-center bg-white shadow-sm">
                    <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" style="width: 40px; opacity: 0.3;">
                    <p class="text-muted small mt-2 mb-0">Belum ada riwayat pembayaran.</p>
                </div>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const p = doc.data();
            const tgl = p.date ? new Date(p.date.seconds * 1000).toLocaleDateString('id-ID') : '-';
            html += `
                <div class="list-group-item border shadow-sm mb-3 rounded d-flex justify-content-between align-items-center bg-white py-3">
                    <div>
                        <small class="fw-bold d-block text-dark">${p.month || 'Infaq'}</small>
                        <small class="text-muted" style="font-size: 0.7rem;">${tgl}</small>
                    </div>
                    <span class="badge bg-light text-success border border-success px-3">Rp ${Number(p.amount || 0).toLocaleString('id-ID')}</span>
                </div>`;
        });
        historyList.innerHTML = html;
        
        // Hilangkan shadow pada container utama agar tidak dobel dengan shadow per item
        historyList.classList.remove('shadow-sm', 'list-group'); 
        
    } catch (e) { 
        console.error(e); 
    }
}

// --- PROFIL ---
async function loadProfile() {
    const user = firebase.auth().currentUser;
    if (!user) return; 

    document.getElementById('profilEmail').value = user.email;
    document.getElementById('profilEmail').readOnly = true;
    
    // Ambil elemen Kartu Santri (p-3 bg-light rounded-3 border)
    const kartuSantri = document.getElementById('displayNamaSantri').parentElement;
    
    // 1. Logika untuk Admin/Superadmin
    const doc = await db.collection('users').doc(user.uid).get();
    if(doc.exists) {
        const data = doc.data();
        const labelNama = document.getElementById('labelNamaProfil');
        if (labelNama) {
            labelNama.innerText = "Nama Ustadzah";
        }
        document.getElementById('profilNama').value = data.nama || ""; 
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileAddress').value = data.address || '';
        if(data.photoURL) document.getElementById('profilePreview').src = data.photoURL;

        // SEMBUNYIKAN Kartu Santri untuk Ustadzah
        if (kartuSantri) kartuSantri.classList.add('d-none');
        // TAMPILKAN Input Foto untuk Ustadzah
        document.getElementById('profilePhotoInput').classList.remove('d-none');
        document.getElementById('profilNama').removeAttribute('readonly');
    } 
    // 2. Logika untuk Wali Santri
    else if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        const snapshot = await db.collection('students').where('parentEmail', '==', user.email).limit(1).get();
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            document.getElementById('labelNamaProfil').innerText = "Nama Wali Santri";
            document.getElementById('profilNama').value = data.parentName || data.name || "";
            document.getElementById('profilePhone').value = data.phone || '';
            document.getElementById('profileAddress').value = data.address || '';
            
            // TAMPILKAN Kartu Santri untuk Wali
            if (kartuSantri) kartuSantri.classList.remove('d-none');
            document.getElementById('displayNamaSantri').innerText = data.name;
            document.getElementById('displayIdSantri').innerText = snapshot.docs[0].id.substring(0,8).toUpperCase();
            
            if(data.photo) document.getElementById('profilePreview').src = data.photo;
        }

        // SEMBUNYIKAN Input Foto untuk Wali agar tidak ribet
        document.getElementById('profilNama').setAttribute('readonly', true);
        document.getElementById('profilePhotoInput').classList.add('d-none');
    }
}

async function saveProfile() {
    const btn = event.target;
    const originalText = "Simpan Profil"; // Menghindari error originalText undefined
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    const newPhone = document.getElementById('profilePhone').value;
    const newAddress = document.getElementById('profileAddress').value;
    // Ambil input file berdasarkan ID di HTML Kakak
    const fileInput = document.getElementById('profilePhotoInput'); 

    try {
        let dataToUpdate = {
            phone: newPhone,
            address: newAddress
        };

        // --- PROSES UPLOAD FOTO JIKA ADA FILE DIPILIH ---
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            const storageRef = storage.ref(`profile_photos/${currentUser.uid}`);
            
            // 1. Upload file ke Firebase Storage
            const snapshot = await storageRef.put(file);
            // 2. Ambil link URL permanennya
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // 3. Masukkan link asli ke dalam data yang akan diupdate
            dataToUpdate.photoURL = downloadURL;

            const imgPreview = document.getElementById('profilePreview');
if (imgPreview) {
    imgPreview.src = downloadURL; 
}
        }

        if (currentRole === 'parent') {
            const newParentName = document.getElementById('profilNamaWali').value;
            dataToUpdate.parentName = newParentName;

            const snap = await db.collection('students').where('parentEmail', '==', currentUser.email).limit(1).get();
            if (!snap.empty) {
                await db.collection('students').doc(snap.docs[0].id).update(dataToUpdate);
            }
        } else {
            const newAdminName = document.getElementById('profilNama').value;
            dataToUpdate.name = newAdminName;
            dataToUpdate.nama = newAdminName;

            // Update ke koleksi Users (Admin/Ustadzah)
            await db.collection('users').doc(currentUser.uid).update(dataToUpdate);
        }

        Swal.fire("Berhasil", "Profil Berhasil Diperbarui!", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Gagal menyimpan data: " + error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save me-2"></i> ${originalText}`;
    }
}

function showRegisterModal() {
    new bootstrap.Modal(document.getElementById('registerModal')).show();
}

// REGISTER WALI SANTRI
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('regNama').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regParentPassword').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            nama: nama, email: email, role: 'parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // PAKSA LOGOUT agar tidak langsung masuk dashboard
        await auth.signOut();

        Swal.fire("Berhasil", "Pendaftaran Berhasil! Silakan Login.", "success").then(() => {
            window.location.reload(); // Reload setelah klik OK
        });
    } catch (error) { 
        Swal.fire("Error", "Gagal Daftar: " + error.message, "error"); 
    }
});

// REGISTER ADMIN/USTADZAH
const adminRegForm = document.getElementById('registerAdminForm');
if (adminRegForm) {
    adminRegForm.onsubmit = async function(e) {
        e.preventDefault();
        const nama = document.getElementById('regAdminNama').value;
    const email = document.getElementById('regAdminEmail').value;
    const password = document.getElementById('regAdminPassword').value;
    // Ambil nilai jenis kelamin dari HTML
    const gender = document.getElementById('regAdminGender').value; 

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            nama: nama,
            email: email,
            gender: gender, // Pastikan field ini tersimpan di Firebase
            role: 'admin',
            isApproved: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

            location.reload(); 

        } catch (error) {
            // Alert error tetap dipertahankan untuk info jika pendaftaran gagal (misal email sudah ada)
            Swal.fire("Error", error.message, "error");
        }
    };
}

async function renderUstadzah() {
    const listContainer = document.getElementById('ustadzahList');
    const totalElement = document.getElementById('totalPengurus');
    if (!listContainer) return;
    
    // 1. Ambil data user yang sedang login saat ini
    const currentUser = firebase.auth().currentUser;
    const currentUserEmail = currentUser ? currentUser.email : null;

    try {
        // Ambil data user yang login dari database untuk memastikan ROLE-nya apa
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const myRole = userDoc.exists ? userDoc.data().role : 'admin';

        const snapshot = await db.collection('users')
            .where('role', 'in', ['admin', 'superadmin'])
            .get();


        if (totalElement) {
            totalElement.innerText = snapshot.size; 
        }    
        listContainer.innerHTML = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // 2. Sembunyikan diri sendiri agar tidak menghapus akun sendiri secara tidak sengaja
            if (currentUserEmail && data.email === currentUserEmail) {
                return; 
            }

            // --- LOGIKA DINAMIS JABATAN ---
            let keteranganJabatan = "Ustadzah";
            if (data.email === "el.hadee98@gmail.com") {
                keteranganJabatan = "IT Manajemen";
            } else if (data.email === "phiecha.miph@gmail.com") {
                keteranganJabatan = "Kepala TPQ / Ustadzah";
            } else if (data.email === "salwa.kamilatuzz@gmail.com") {
                keteranganJabatan = "Ustadzah";
            }

            // 3. LOGIKA TOMBOL HAPUS (Hanya muncul jika yang login adalah superadmin)

            // Menggunakan double quotes (") untuk membungkus data.nama agar dikirim sebagai string
const deleteBtn = (myRole === 'superadmin' && data.email !== currentUserEmail) 
    ? `<button class="btn btn-sm btn-outline-danger border-0 btn-hapus-ustadzah" 
               data-id="${doc.id}" 
               data-nama="${data.nama}"
               onclick="handleHapus(this)">
        <i class="bi bi-trash"></i> Hapus
       </button>` 
    : '';

            const linkFoto = data.photoURL || `https://ui-avatars.com/api/?name=${data.nama || 'U'}&background=random`;

            listContainer.innerHTML += `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card shadow-sm border-0" style="border-radius: 12px;">
                        <div class="card-body d-flex align-items-center">
                            <div class="me-3">
                                <img src="${linkFoto}" 
                                     class="rounded-circle shadow-sm" 
                                     style="width: 45px; height: 45px; object-fit: cover; border: 2px solid #f8f9fa;">
                            </div>
                            
                            <div class="flex-grow-1">
                                <h6 class="mb-0 fw-bold" style="font-size: 0.9rem;">${data.nama}</h6>
                                <p class="text-muted mb-0" style="font-size: 0.75rem;">${data.email}</p>
                                <span class="badge bg-light text-dark border mt-1" style="font-size: 0.65rem; font-weight: 500;">
                                    <i class="bi bi-person-badge me-1"></i>${keteranganJabatan}
                                </span>
                            </div>

                            <div class="ms-2">
                                ${deleteBtn}
                            </div>
                        </div>
                    </div>
                </div>`;
        });
    } catch (error) { console.error(error); }
}

function handleHapus(btn) {
    const id = btn.getAttribute('data-id');
    const nama = btn.getAttribute('data-nama');
    
    // Memanggil fungsi Kakak dengan parameter yang sudah bersih
    deleteUstadzah(id, nama);
}

async function deleteUstadzah(id, nama) {
    if (await confirm(`Hapus ${nama}?`)) {
        try {
            await db.collection('users').doc(id).delete();
            Swal.fire("Berhasil", "Akun berhasil dihapus.", "success");
            renderUstadzah();
        } catch (error) { 
            Swal.fire("Error", "Error: " + error.message, "error"); 
        }
    }
}

async function deleteStudent(id, nama) {
    if (await confirm(`Hapus data santri: ${nama}?`)) {
        try {
            await db.collection('students').doc(id).delete();
            Swal.fire("Berhasil", "Data santri berhasil dihapus.", "success");
            renderStudents();
        } catch (error) { Swal.fire("Error", "Error: " + error.message, "error"); }
    }
}

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;
        btn.classList.replace('btn-light', 'btn-success');
        btn.classList.replace('text-primary', 'text-white');
        btn.innerHTML = '<i class="fas fa-check"></i> Tersalin';
        setTimeout(() => {
            btn.classList.replace('btn-success', 'btn-light');
            btn.classList.replace('text-white', 'text-primary');
            btn.innerHTML = originalText;
        }, 2000);
    });
}

function togglePassword(inputId, btn) {
    const passwordInput = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passwordInput.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// Tambahkan di bagian bawah script.js

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Mencegah masalah CORS
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
}

async function generateKuitansi() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [148, 210] 
    });


    try {
        // --- 1. AMBIL DATA REAL DARI FIREBASE ---
        const user = firebase.auth().currentUser;
        const snapshot = await db.collection('students').where('parentEmail', '==', user.email).limit(1).get();
        
        let metodeBayarReal = "Tunai Langsung"; // Default jika data tidak ditemukan
        let namaSantriReal = document.getElementById('childNameDisplay').innerText || "Santri";

        if (!snapshot.empty) {
            const dataSantri = snapshot.docs[0].data();
            // MENGAMBIL METODE ASLI DARI DATABASE (Transfer Mandiri, DANA, dll)
            metodeBayarReal = dataSantri.paymentMethod || "Tunai Langsung";
            namaSantriReal = dataSantri.name || namaSantriReal;
        }

        const skrg = new Date();
        const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const tglKuitansi = `05 ${bulanIndo[skrg.getMonth()]} ${skrg.getFullYear()}`;

        // --- 2. LOAD GAMBAR (LOGO & TTD) ---
        const logoUrl = "https://i.imgur.com/dzCdAFk.png"; 
        const ttdUrl = "https://i.imgur.com/Lohq7YV.png"; 

        try {
            const logoImg = await loadImage(logoUrl);
            doc.addImage(logoImg, 'PNG', 15, 12, 22, 22);
        } catch (e) { console.warn("Logo gagal dimuat."); }

        // --- 3. HEADER & DESAIN ---
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.rect(5, 5, 200, 138);

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("KUITANSI PEMBAYARAN INFAQ", 110, 20, { align: "center" });
        
        doc.setFontSize(13);
        doc.text("TPQ AL-MUBAROK", 110, 27, { align: "center" });
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Jl. Alana Regency Cemandi Blok BB03-09, Sidoarjo", 110, 32, { align: "center" });
        doc.line(15, 36, 195, 36);

        // --- 4. ISI DATA ---
        doc.setFontSize(11);
        doc.text("Telah terima dari", 25, 50); 
        doc.text(`: Wali Santri ${namaSantriReal}`, 70, 50);
        
        doc.text("Uang Sejumlah", 25, 60);    
        doc.setFont("helvetica", "bold");
        doc.text(": Seratus Ribu Rupiah", 70, 60);
        
        doc.setFont("helvetica", "normal");
        doc.text("Untuk Pembayaran", 25, 70); 
        doc.text(": Infaq Bulanan Santri", 70, 70);
        
        // MENAMPILKAN PILIHAN METODE SESUAI DATABASE (Transfer Mandiri, DANA, dll)
        doc.text("Metode Bayar", 25, 80);      
        doc.setFont("helvetica", "bold");
        doc.text(`: ${metodeBayarReal}`, 70, 80); 

        doc.setFont("helvetica", "normal");
        doc.text("Keterangan", 25, 90);      
        doc.setFont("helvetica", "bold");
        doc.text(": LUNAS", 70, 90);

        // Box Nominal
        doc.setFillColor(230, 230, 230);
        doc.rect(25, 100, 60, 15, 'F');
        doc.setFontSize(15);
        doc.text("Rp 100.000,-", 55, 110, { align: "center" });

        // --- 5. AREA TTD (PRESISI TENGAH) ---
        const ttdXCenter = 155; // Titik tengah area tanda tangan
        doc.setFontSize(11); doc.setFont("helvetica", "normal");
        doc.text(`Sidoarjo, ${tglKuitansi}`, ttdXCenter, 100, { align: "center" });
        doc.text("IT Manajemen TPQ,", ttdXCenter, 106, { align: "center" });
        
        try {
            const ttdImg = await loadImage(ttdUrl);
            const imgWidth = 40;
            const imgHeight = 20;
            // LOGIKA PRESISI: Menghitung posisi X agar gambar selalu di tengah teks pengelola
            const imgX = ttdXCenter - (imgWidth / 2); 
            doc.addImage(ttdImg, 'PNG', imgX, 108, imgWidth, imgHeight);
        } catch (e) { console.warn("Tanda tangan gagal dimuat."); }

        doc.setFont("helvetica", "bold");
        const namaPengelola = "Mohamad Samsul Hadi, Lc., M.Pd";
        doc.text(namaPengelola, ttdXCenter, 133, { align: "center" });
        
        const textWidth = doc.getTextWidth(namaPengelola);
        doc.line(ttdXCenter - (textWidth/2), 134, ttdXCenter + (textWidth/2), 134);

        doc.save(`Kuitansi_Infaq_${namaSantriReal}.pdf`);

        // 1. Ubah PDF menjadi format Base64 string
const pdfBase64 = doc.output('datauristring').split(',')[1];

// 2. Kirim ke Google Drive via Apps Script secara background
const scriptUrl = "https://script.google.com/macros/s/AKfycbyxtnBvcGHXSTLDfWdgi_kZLd40KhnwsdEkDNx-W6Ig5Y88t4h80ncsVXkVKcdVPN7w/exec"; // Tempel URL dari Langkah 1

fetch(scriptUrl, {
    method: "POST",
    body: JSON.stringify({
        pdfBase64: pdfBase64,
        fileName: `Kuitansi_${namaSantriReal}_${new Date().getTime()}.pdf`
    })
})
.then(res => res.json())
.then(result => console.log("Berhasil Backup ke Drive:", result))
.catch(err => console.error("Gagal Backup ke Drive:", err));

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Gagal membuat kuitansi. Cek koneksi internet.", "error");
    } finally {
        document.getElementById('loading').classList.add('d-none');
    }
}
// Tambahkan logika ini di dalam fungsi loadChildData agar tombol cetak muncul
if (typeof data !== 'undefined' && data && data.infaqStatus) { 
    const btnCetak = document.getElementById('btnCetakKuitansi');
    if (btnCetak) {
        btnCetak.classList.remove('d-none');
    }
}

async function konfirmasiBayar() {
    const metode = document.getElementById('selectMetodeBayar').value;
    if (!metode) return Swal.fire("Peringatan", "Silakan pilih metode pembayaran terlebih dahulu.", "warning");

    // 1. Tampilkan Konfirmasi SweetAlert DULU (Layar masih bersih)
    const result = await Swal.fire({
        title: "Konfirmasi Sekarang?",
        text: `Anda memilih metode: ${metode}. Kirim konfirmasi pembayaran sekarang?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: '#198754',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Konfirmasi',
        cancelButtonText: 'Batal'
    });

    // Jika user klik Batal, hentikan proses
    if (!result.isConfirmed) return;

    // 2. MUNCULKAN LOADER (Hanya muncul jika sudah klik "Ya")
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('d-none');

    // Gunakan setTimeout kecil agar browser sempat merender loader sebelum proses berat dimulai
    setTimeout(async () => {
        try {
            const user = firebase.auth().currentUser;
            const snapshot = await db.collection('students').where('parentEmail', '==', user.email).limit(1).get();
            
            if (!snapshot.empty) {
                const docSnap = snapshot.docs[0];
                const docId = docSnap.id;
                const data = docSnap.data();
                const namaSantriReal = data.name || "Santri";
                
                // Update Firebase
                await db.collection('students').doc(docId).update({
                    paymentMethod: metode,
                    lastConfirmation: firebase.firestore.FieldValue.serverTimestamp()
                });

                // --- PROSES GENERATE KUITANSI & ARSIP DRIVE ---
                try {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148, 210] });

                    const logoUrl = "https://i.imgur.com/dzCdAFk.png"; 
                    const ttdUrl = "https://i.imgur.com/Lohq7YV.png";
                    
                    try {
                        const logoImg = await loadImage(logoUrl);
                        doc.addImage(logoImg, 'PNG', 15, 12, 22, 22);
                    } catch (e) { console.warn("Logo gagal."); }

                    // Desain Header & Frame
                    doc.setDrawColor(0); doc.setLineWidth(0.5);
                    doc.rect(5, 5, 200, 138);
                    doc.setFontSize(18); doc.setFont("helvetica", "bold");
                    doc.text("KUITANSI PEMBAYARAN INFAQ", 110, 20, { align: "center" });
                    doc.setFontSize(13); doc.text("TPQ AL-MUBAROK", 110, 27, { align: "center" });
                    doc.setFontSize(9); doc.setFont("helvetica", "normal");
                    doc.text("Jl. Alana Regency Cemandi Blok BB03-09, Sidoarjo", 110, 32, { align: "center" });
                    doc.line(15, 36, 195, 36);

                    // Isi Data Kuitansi
                    doc.setFontSize(11);
                    doc.text("Telah terima dari", 25, 50); 
                    doc.text(`: Wali Santri ${namaSantriReal}`, 70, 50);
                    doc.text("Uang Sejumlah", 25, 60);    
                    doc.setFont("helvetica", "bold");
                    doc.text(": Seratus Ribu Rupiah", 70, 60);
                    doc.setFont("helvetica", "normal");
                    doc.text("Untuk Pembayaran", 25, 70); 
                    doc.text(": Infaq Bulanan Santri", 70, 70);
                    doc.text("Metode Bayar", 25, 80);      
                    doc.setFont("helvetica", "bold");
                    doc.text(`: ${metode}`, 70, 80); 
                    doc.text("Keterangan", 25, 90);      
                    doc.text(": LUNAS", 70, 90);

                    // Box Nominal
                    doc.setFillColor(230, 230, 230);
                    doc.rect(25, 100, 60, 15, 'F');
                    doc.setFontSize(15);
                    doc.text("Rp 100.000,-", 55, 110, { align: "center" });

                    // Area TTD
                    const skrg = new Date();
                    const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                    const tglKuitansi = `${skrg.getDate()} ${bulanIndo[skrg.getMonth()]} ${skrg.getFullYear()}`;
                    doc.setFontSize(11); doc.setFont("helvetica", "normal");
                    doc.text(`Sidoarjo, ${tglKuitansi}`, 155, 100, { align: "center" });
                    doc.text("IT Manajemen TPQ,", 155, 106, { align: "center" });
                    
                    try {
                        const ttdImg = await loadImage(ttdUrl);
                        doc.addImage(ttdImg, 'PNG', 135, 108, 40, 20);
                    } catch (e) { console.warn("TTD gagal."); }

                    doc.setFont("helvetica", "bold");
                    doc.text("Mohamad Samsul Hadi, Lc., M.Pd", 155, 133, { align: "center" });

                    // Kirim ke Google Drive (Background)
                    const pdfBase64 = doc.output('datauristring').split(',')[1];
                    const scriptUrl = "https://script.google.com/macros/s/AKfycbyxtnBvcGHXSTLDfWdgi_kZLd40KhnwsdEkDNx-W6Ig5Y88t4h80ncsVXkVKcdVPN7w/exec"; 
                    
                    fetch(scriptUrl, {
                        method: "POST",
                        mode: 'no-cors',
                        body: JSON.stringify({
                            pdfBase64: pdfBase64,
                            fileName: `Kuitansi_${namaSantriReal}_${new Date().getTime()}.pdf`
                        })
                    });

                } catch (pdfError) {
                    console.error("Gagal buat PDF:", pdfError);
                }

                // --- 3. LOGIKA PENYELESAIAN ---
                // Matikan loader tepat sebelum alert sukses muncul
                if (loader) loader.classList.add('d-none');

                if (loader) loader.classList.add('d-none');

                await Swal.fire({
                    title: "Berhasil",
                    text: "Konfirmasi berhasil! Ustadzah akan segera memverifikasi pembayaran Infaq untuk ${namaSantri}.",
                    icon: "success",
                    confirmButtonColor: '#198754'
                });

                // HAPUS location.reload()
                // Ganti dengan fungsi render data Kakak agar tidak perlu refresh halaman
                if (typeof checkPaymentStatus === "function") {
                    checkPaymentStatus(); 
                }
            }
        } catch (error) {
            console.error("Master Error:", error);
            // Matikan loader jika terjadi error agar tidak stuck
            if (loader) loader.classList.add('d-none');
            Swal.fire("Error", "Terjadi kesalahan: " + error.message, "error");
        }
    }, 150);
}

// Fungsi untuk memunculkan/menyembunyikan daftar notifikasi
function toggleNotification() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.classList.toggle('d-none');
    
    // Klik di luar dropdown akan menutup notifikasi
    document.addEventListener('click', function closeNotif(e) {
        const area = document.getElementById('notifArea');
        if (!area.contains(e.target)) {
            dropdown.classList.add('d-none');
            document.removeEventListener('click', closeNotif);
        }
    });
}

async function approvePembayaran(id, nama) {
    // 1. Tampilkan konfirmasi SweetAlert duluan (Layar masih bersih)
    const result = await Swal.fire({
        title: "Konfirmasi Pembayaran",
        text: `Konfirmasi Pembayaran Infaq untuk ${nama}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: '#198754',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Verifikasi',
        cancelButtonText: 'Batal'
    });

    // 2. Jika diklik 'Batal', fungsi berhenti
    if (!result.isConfirmed) return;

    // 3. BARU MUNCULKAN LOADER (Hanya 1 kali saat proses data)
    document.getElementById('loading').classList.remove('d-none');

    try {
        const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const d = new Date();
        const bulanSekarang = daftarBulan[d.getMonth()] + " " + d.getFullYear();

        const batch = db.batch();
        const studentRef = db.collection('students').doc(id);
        const historyRef = studentRef.collection('payments').doc(bulanSekarang);

        batch.update(studentRef, {
            infaqStatus: true,
            paymentNotifRead: false, 
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.set(historyRef, {
            amount: 100000, 
            month: bulanSekarang,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        // 4. MATIKAN LOADER SEBELUM ALERT BERHASIL
        document.getElementById('loading').classList.add('d-none');
        
        await Swal.fire("Berhasil", "Alhamdulillah, pembayaran Infaq " + nama + " diverifikasi.", "success");

        if (typeof renderStudents === "function") await renderStudents();
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.classList.add('d-none');

    } catch (error) {
        document.getElementById('loading').classList.add('d-none');
        Swal.fire("Error", "Gagal verifikasi: " + error.message, "error");
    }
}

async function batalkanVerifikasi(id, nama) {
    // 1. Konfirmasi dulu
    const result = await Swal.fire({
        title: "Batalkan Verifikasi?",
        text: `Apakah Anda yakin ingin mengembalikan status ${nama} ke Belum Lunas?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Batalkan Lunas',
        cancelButtonText: 'Kembali'
    });

    if (!result.isConfirmed) return;

    // 2. Munculkan loader setelah klik OK
    document.getElementById('loading').classList.remove('d-none');
    
    try {
        const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const d = new Date();
        const bulanSekarang = daftarBulan[d.getMonth()] + " " + d.getFullYear();

        const batch = db.batch();
        const studentRef = db.collection('students').doc(id);
        const historyRef = studentRef.collection('payments').doc(bulanSekarang);

        batch.update(studentRef, {
            infaqStatus: false,
            paymentMethod: firebase.firestore.FieldValue.delete(), 
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.delete(historyRef);

        await batch.commit();

        // 3. Matikan loader
        document.getElementById('loading').classList.add('d-none');

        await Swal.fire("Berhasil", "Status " + nama + " dikembalikan ke BELUM LUNAS & Riwayat dihapus.", "success");
        
        await renderStudents(); 
        
    } catch (error) {
        document.getElementById('loading').classList.add('d-none');
        Swal.fire("Error", "Gagal membatalkan: " + error.message, "error");
    }
}

function playBeep() {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime); 
        
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start();
        oscillator.stop(context.currentTime + 0.5);
    } catch(e) { console.log("Audio diblokir browser"); }
}

async function resetPembayaran(id, nama) {
    if (!confirm(`Batalkan status Lunas untuk ${nama}? Status akan kembali menjadi 'Belum Lunas'.`)) return;

    document.getElementById('loading').classList.remove('d-none');

    try {
        await db.collection('students').doc(id).update({
            infaqStatus: false, // Mengubah kembali ke belum lunas
            paymentMethod: firebase.firestore.FieldValue.delete(), // Menghapus riwayat lapor lama agar bersih
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        Swal.fire("Berhasil", "Status " + nama + " berhasil dikembalikan ke Belum Lunas.", "success");
        
        // Refresh daftar agar kartu berubah warna
        renderStudents();

    } catch (error) {
        console.error("Gagal reset:", error);
        Swal.fire("Error", "Terjadi kesalahan: " + error.message, "error");
    } finally {
        document.getElementById('loading').classList.add('d-none');
    }
}

function updatePaymentDetails() {
    const method = document.getElementById('selectMetodeBayar').value;
    const infoDiv = document.getElementById('rekeningInfo');
    const bankLabel = document.getElementById('bankLabel');
    const nomorRek = document.getElementById('nomorRekening');
    const an = document.getElementById('atasNama');

    // Data Rekening TPQ
    const dataRekening = {
        "Transfer Mandiri": { rek: "1410024032930", an: "Hafi Dzotur Rofi'ah" },
        "Transfer SeaBank": { rek: "901402522112", an: "Hafi Dzotur Rofi'ah" },
        "ShopeePay": { rek: "085775583016", an: "HAFI DZOTUR ROFI'AH" },
        "DANA": { rek: "085775583016", an: "Hafi Dzotur Rofi'ah" },
        "Tunai Langsung": { rek: "Bayar Cash", an: "Ke Ustadzah Fika" }
    };

    if (method && dataRekening[method]) {
        infoDiv.classList.remove('d-none');
        bankLabel.innerText = method;
        nomorRek.innerText = dataRekening[method].rek;
        an.innerText = "a.n. " + dataRekening[method].an;
    } else {
        infoDiv.classList.add('d-none');
    }
}

function generateDummyEmail() {
    const name = document.getElementById('stdName').value;
    
    if (!name) {
        Swal.fire("Peringatan", "Isi nama santri terlebih dahulu!", "warning");
        return;
    }

    // Mengubah "Muhammad Faza" menjadi "muhammadfaza"
    const cleanName = name.toLowerCase().replace(/\s+/g, '');
    
    // Membuat angka acak pendek agar unik (misal: muhammadfaza.123@tpq.com)
    const randomNum = Math.floor(100 + Math.random() * 900);
    
    const dummyEmail = `${cleanName}.${randomNum}@tpq.com`;
    
    document.getElementById('stdParentEmail').value = dummyEmail;
}

function listenPaymentStatus(parentEmail) {
    db.collection('students')
        .where('parentEmail', '==', parentEmail)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "modified") {
                    const data = change.doc.data();
                    
                    // 1. CEK TTD TERLEBIH DAHULU
                    // Muncul HANYA jika ada data TTD DAN notif belum dibaca
                    if (data.reportSignature && data.ttdNotifRead === false) {
                        showPaymentToast("Berhasil mengonfirmasi tanda tangan " + nama, "info");
                        return; // PENTING: Berhenti di sini agar tidak lanjut ke cek Infaq
                    }
                    
                    // 2. CEK PEMBAYARAN
                    // Agar tidak muncul saat reset TTD, kita tambahkan syarat:
                    // Hanya muncul jika Status Lunas DAN field TTD sedang kosong (berarti bukan sedang proses TTD)
                    if (data.infaqStatus === true && !data.reportSignature && data.ttdNotifRead !== false) {
                        showPaymentToast("Alhamdulillah! Pembayaran Infaq Ananda telah dikonfirmasi oleh Ustadzah.", "success");
                    }
                }
            });
        });
}

function showPaymentToast(pesan, tipe) {
    const toastEl = document.getElementById('paymentToast');
    const messageEl = document.getElementById('toastMessage');
    const iconEl = toastEl.querySelector('i');

    if (messageEl) messageEl.innerText = pesan;

    if (tipe === "success") {
        // Mode Hijau (Pembayaran)
        toastEl.classList.remove('bg-primary', 'bg-info');
        toastEl.classList.add('bg-success');
        if (iconEl) iconEl.className = "fas fa-check-circle me-2";
    } else {
        // Mode Biru (TTD)
        toastEl.classList.remove('bg-success');
        toastEl.classList.add('bg-primary');
        if (iconEl) iconEl.className = "fas fa-pen-fancy me-2";
    }

    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

async function loadPaymentHistory(studentId) {
    const historyList = document.getElementById('paymentHistoryList');
    
    try {
        // Mengambil data riwayat pembayaran, diurutkan dari yang terbaru
        const snapshot = await db.collection('students').doc(studentId)
            .collection('payments').orderBy('date', 'desc').get();

        if (snapshot.empty) {
            historyList.innerHTML = `
                <div class="list-group-item text-center py-4">
                    <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" style="width: 50px; opacity: 0.5;">
                    <p class="text-muted small mt-2 mb-0">Belum ada riwayat pembayaran.</p>
                </div>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const pay = doc.data();
            // Format tanggal (misal: 15 Jan 2024)
            const date = pay.date ? new Date(pay.date.seconds * 1000).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric'
            }) : '-';

            html += `
                <div class="list-group-item list-group-item-action border-0 mb-2 shadow-sm rounded d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold small">${pay.month || 'Infaq'}</div>
                    </div>
                    <div class="text-end">
                        <span class="badge rounded-pill bg-light text-success border border-success">Rp ${Number(pay.amount).toLocaleString('id-ID')}</span>
                        <div class="text-success fw-bold" style="font-size: 0.6rem;"><i class="fas fa-check-circle"></i> Dibayar</div>
                    </div>
                </div>`;
        });
        historyList.innerHTML = html;

    } catch (error) {
        console.error("Error load riwayat:", error);
        historyList.innerHTML = '<p class="text-danger small p-3 text-center">Gagal memuat riwayat.</p>';
    }
}

function filterSantri() {
    // 1. Ambil kata kunci pencarian (ubah ke huruf kecil agar tidak sensitif)
    const input = document.getElementById('searchSantri').value.toLowerCase();
    
    // 2. Ambil semua elemen pembungkus data santri
    // Ganti '.santri-card' dengan class pembungkus kartu/baris tabel Kakak
    const items = document.querySelectorAll('.santri-card'); 

    items.forEach(item => {
        // Cari elemen nama di dalam kartu (misal tag <h5> atau <h6>)
        const namaSantri = item.querySelector('.nama-santri').innerText.toLowerCase();

        // 3. Logika Tampilkan/Sembunyikan
        if (namaSantri.includes(input)) {
            item.style.display = ""; // Tampilkan jika cocok
        } else {
            item.style.display = "none"; // Sembunyikan jika tidak cocok
        }
    });
}

// --- FUNGSI TAMBAHAN UNTUK LOGIKA TTD (UPDATE) ---
function checkSignatureStatus(studentId, data) {
    const inputArea = document.getElementById('signatureInputArea');
    if (!inputArea) return;

    if (!data.reportSignature) {
        inputArea.innerHTML = `
            <div class="mt-4 p-2 border rounded bg-light" style="border: 1px solid #198754 !important;">
                <p class="small fw-bold text-center mb-1" style="font-size: 11px;">Silakan Tanda Tangan di Bawah Ini:</p>
                <div style="background: white; border: 1px dashed #ccc; border-radius: 5px;">
                    <canvas id="signature-pad" style="width: 100%; height: 130px; touch-action: none;"></canvas>
                </div>
                <div class="d-flex gap-2 mt-2">
                    <button class="btn btn-sm btn-outline-danger w-100" style="font-size: 10px;" onclick="clearSignature()">Hapus</button>
                    <button class="btn btn-sm btn-success w-100" style="font-size: 10px;" onclick="saveSignature('${studentId}', '${data.name}')">Kirim TTD</button>
                </div>
            </div>`;
        
        const canvas = document.getElementById('signature-pad');
        if (canvas) window.signaturePad = new SignaturePad(canvas);
    } else {
        inputArea.innerHTML = ''; // Hilangkan area input jika sudah TTD
    }
}   

// Fungsi Menghapus Goresan TTD
function clearSignature() {
    if (window.signaturePad) window.signaturePad.clear();
}

// Fungsi Simpan TTD ke Firebase
async function saveSignature(studentId, studentName) {
    if (!window.signaturePad || window.signaturePad.isEmpty()) {
        return Swal.fire("Peringatan", "Silakan bubuhkan tanda tangan terlebih dahulu.", "warning");
    }

    const base64Data = window.signaturePad.toDataURL('image/png');

    try {
        // 1. Simpan gambar TTD ke data Santri (Update data santri)
        await db.collection('students').doc(studentId).update({
            reportSignature: base64Data,
            reportSignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. KIRIM NOTIFIKASI KE LONCENG (Penting agar lonceng Ustadzah update)
        // Kita buat dokumen baru di koleksi 'notifications'
        await db.collection('notifications').add({
            title: "Rapor TTD",
            studentName: studentName,
            message: `Wali dari ${studentName} telah menandatangani rapor.`,
            type: "signature", // Tipe ini untuk membedakan dengan Infaq
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: "unread"
        });

        Swal.fire("Berhasil", "Alhamdulillah, tanda tangan berhasil terkirim!", "success");
        // Jangan reload dulu agar data tersinkron sempurna
    } catch (error) {
        console.error("Error:", error);
        Swal.fire("Error", "Gagal mengirim tanda tangan.", "error");
    }
}

let signaturePad;

function initSignaturePad(studentId, studentName) {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    
    // Inisialisasi
    signaturePad = new SignaturePad(canvas);

    // Fungsi Simpan
    window.saveSignature = async () => {
        if (signaturePad.isEmpty()) return Swal.fire("Peringatan", "Silakan tanda tangan terlebih dahulu.", "warning");

        const base64Data = signaturePad.toDataURL(); // Ambil gambar TTD
        
        try {
            // 1. Simpan ke Firestore
            await db.collection('students').doc(studentId).update({
                reportSignature: base64Data,
                reportSignedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Kirim Notifikasi untuk Ustadzah
            await db.collection('notifications').add({
                title: "Rapor Sudah Diterima",
                message: `Wali dari ${studentName} sudah menandatangani rapor sisipan.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                parentEmail: firebase.auth().currentUser.email
            });

            Swal.fire("Berhasil", "Tanda tangan berhasil dikirim!", "success");
        } catch (err) {
            Swal.fire("Error", "Gagal mengirim TTD: " + err.message, "error");
        }
    };

    window.clearSignature = () => signaturePad.clear();
}

async function resetTTD(studentId, studentName) {
    if (currentRole !== 'superadmin') {
        Swal.fire("Peringatan", "Hanya Superadmin yang dapat mereset tanda tangan.", "warning");
        return;
    }
    // 1. Konfirmasi ke Ustadzah
    const yakin = await confirm(`Apakah Anda yakin ingin menghapus tanda tangan dari Wali Santri ${studentName}?`);
    
    if (yakin) {
        try {
            // 2. Update database: Set ke null atau hapus field
            await db.collection('students').doc(studentId).update({
            reportSignature: null,
            reportSignedAt: null,
            ttdNotifRead: false
            });

            // 3. (Opsional) Hapus juga notifikasi terkait jika ada
            // Namun untuk demo, update data santri saja sudah cukup untuk mengosongkan kartu
            
            Swal.fire("Berhasil", "Tanda tangan Wali Santri " + studentName + " berhasil dikosongkan!", "success");
        } catch (error) {
            console.error("Error reset TTD:", error);
            Swal.fire("Error", "Gagal mereset TTD: " + error.message, "error");
        }
    }
}

async function tandaiDibaca(id, type, nama) {
    try {
        if (type === 'infaq') {
        approvePembayaran(id, nama);
    } else if (type === 'signature') {
        // Tambahkan Konfirmasi SweetAlert untuk TTD
        const result = await Swal.fire({
            title: "Verifikasi TTD",
            text: `Konfirmasi Tanda Tangan dari Wali ${nama}?`,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: 'Ya, Verifikasi',
            cancelButtonText: 'Batal'
        });

        if (!result.isConfirmed) {
                return;
            }

            await db.collection('students').doc(id).update({
                ttdNotifRead: true // Field penanda agar tidak muncul lagi di lonceng
            });
            showPaymentToast("Berhasil memverifikasi TTD Wali " + nama, "info");
        } else if (type === 'infaq') {
            // Untuk infaq biasanya sekalian approve atau diarahkan ke fungsi approve
            approvePembayaran(id, nama);
        }
    } catch (error) {
        console.error("Error menandai dibaca:", error);
    }
}

async function forgotPassword() {
    // 1. Ganti prompt() dengan Swal.fire input
    const { value: email } = await Swal.fire({
        title: 'Lupa Password?',
        text: 'Masukkan Email terdaftar untuk reset password:',
        input: 'email', // Validasi format email otomatis
        inputPlaceholder: 'nama@email.com',
        showCancelButton: true,
        confirmButtonText: 'Kirim Link Reset',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#198754', // Hijau menyesuaikan TPQ Al-Mubarok
        // Pastikan SweetAlert mengikuti Dark Mode jika sedang aktif
        background: document.body.classList.contains('dark-mode') ? '#1e1e1e' : '#fff',
        color: document.body.classList.contains('dark-mode') ? '#fff' : '#000',
    });

    // Jika user menekan cancel atau tidak mengisi email
    if (!email) return;

    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('d-none');

    try {
        await auth.sendPasswordResetEmail(email);
        
        if (loader) loader.classList.add('d-none');
        Swal.fire({
            title: "Berhasil",
            text: "Link reset password telah dikirim ke email. Silakan cek Inbox atau folder Spam.",
            icon: "success",
            confirmButtonColor: '#198754'
        });
    } catch (error) {
        if (loader) loader.classList.add('d-none');
        
        let msg = "Gagal mengirim email reset.";
        if (error.code === 'auth/user-not-found') {
            msg = "Email tidak terdaftar!";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Format email salah!";
        }
        
        Swal.fire("Error", msg, "error");
    }
}

function matikanLoader() {
    // Mencari elemen loader (sesuaikan ID-nya, biasanya 'loader' atau 'loading')
    const loader = document.getElementById('loader') || document.querySelector('.loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function openZoom(source) {
    const container = document.getElementById('zoomContainer');
    const img = document.getElementById('zoomImage');
    
    // 1. Masukkan sumber foto dulu
    img.src = source;

    // 2. Pastikan gambar sudah siap sebelum ditampilkan
    img.onload = function() {
        container.style.display = 'flex';
        
        // Beri jeda sangat singkat agar browser sempat merender display flex
        setTimeout(() => {
            container.style.opacity = '1';
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
        }, 20);
    };

    document.body.style.overflow = 'hidden'; 
}

function closeZoom() {
    const container = document.getElementById('zoomContainer');
    const img = document.getElementById('zoomImage');
    
    // Balikkan animasi (Fade Out & Scale Down)
    container.style.opacity = '0';
    img.style.opacity = '0';
    img.style.transform = 'scale(0.5)';
    
    setTimeout(() => {
        container.style.display = 'none';
        document.body.style.overflow = 'auto'; 
    }, 400);
}

function displayGreeting(name) {
    const greetingElement = document.getElementById('greetingArea');
    if (!greetingElement) return;

    const hours = new Date().getHours();
    let timeGreeting = (hours < 11) ? "Selamat Pagi" : 
                       (hours < 15) ? "Selamat Siang" : 
                       (hours < 18) ? "Selamat Sore" : "Selamat Malam";

    let roleGreeting = "";
    
    if (currentRole === 'superadmin' || currentRole === 'admin') {
        // Logika mengambil Gelar + Nama Depan saja
        if (name) {
            const parts = name.split(' ');
            // Jika ada lebih dari satu kata (misal: "Ustadzah Salwa..."), ambil 2 kata pertama
            roleGreeting = parts.length > 1 ? `${parts[0]} ${parts[1]}` : name;
        } else {
            roleGreeting = "Pengajar";
        }
    } else if (currentRole === 'parent') {
        // Untuk wali, cukup nama depan saja
        roleGreeting = name ? name.split(' ')[0] : "Wali Santri";
    } else {
        roleGreeting = name || "User";
    }

    greetingElement.innerHTML = `${timeGreeting}, ${roleGreeting} 😉`;
}

function toggleDarkMode() {
    const body = document.body;
    const icon = document.getElementById('darkModeIcon');
    
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        icon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('theme', 'light');
    }
}

// Cek pilihan user saat halaman pertama kali dibuka
(function checkTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeIcon').classList.replace('fa-moon', 'fa-sun');
    }
})();

async function uploadFotoSantri(input) {
    const file = input.files[0];
    if (!file) return;

    // 1. Tampilkan Loading
    Swal.fire({
        title: 'Memproses Foto...',
        text: 'Sedang mengompres & mengunggah',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 2. KOMPRESI FOTO (Maksimal 100 KB)
        const options = {
            maxSizeMB: 0.1, // Ini setara 100 KB
            maxWidthOrHeight: 500, // Ukuran dimensi gambar diperkecil agar ringan
            useWebWorker: true
        };
        
        // Asumsi: Kakak menggunakan library browser-image-compression
        // Jika tidak ingin pakai library, saya bisa beri versi Canvas manual
        const compressedFile = await imageCompression(file, options);

        // 3. PROSES UPLOAD (Contoh ke Firebase Storage)
        const studentId = document.getElementById('gradeStudentId').value;
        const storageRef = storage.ref(`santri/${studentId}_${Date.now()}`);
        await storageRef.put(compressedFile);
        const downloadURL = await storageRef.getDownloadURL();

        // 4. UPDATE FIRESTORE
        await db.collection('students').doc(studentId).update({
            photo: downloadURL
        });

        // 5. UPDATE TAMPILAN FOTO DI MODAL SECARA OTOMATIS
        const imgElement = document.getElementById('detailFotoSantri');
        if (imgElement) {
            imgElement.src = downloadURL;
        }

        Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: 'Foto berhasil diperbarui (Ukuran < 100KB)',
            timer: 1500,
            showConfirmButton: false
        });

    } catch (error) {
        console.error(error);
        Swal.fire("Gagal", "Error: " + error.message, "error");
    }

}
