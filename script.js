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

window.alert = function(message) {
  return new Promise((resolve) => {

    Swal.fire({
        text: message,
        icon: 'info',
        confirmButtonColor: '#198754',
        confirmButtonText: 'OK'
    });
};

// Khusus untuk confirm (seperti hapus data) agar tidak muncul domain github
window.confirm = async function(message) {
    const result = await Swal.fire({
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Lanjutkan',
        cancelButtonText: 'Batal'
    });
    return result.isConfirmed; // Mengembalikan true atau false
};

// Variables Global
let currentUser = null;
let currentRole = null; // 'admin' atau 'parent' atau 'superadmin'
let studentsData = [];

// --- AUTHENTICATION ---

// Cek status login
auth.onAuthStateChanged(async (user) => {
    const loader = document.getElementById('loading');
    
    // Aktifkan loader segera saat proses pengecekan dimulai
    if (loader) loader.classList.remove('d-none');

    if (user) {
        currentUser = user;
        
        try {
            const unsubscribe = db.collection('users').doc(user.uid).onSnapshot(async (userDoc) => {
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                currentRole = userData.role;

                // FILTER VERIFIKASI ADMIN
                if (currentRole === 'admin' && userData.isApproved === false) {
                    if (loader) loader.classList.add('d-none');
                        const modalDaftar = document.querySelector('.modal.show');
                        if (modalDaftar) {
                            const modalInstance = bootstrap.Modal.getInstance(modalDaftar);
                            if (modalInstance) modalInstance.hide();
                        }

                        console.log("Status: Menunggu Persetujuan...");

                        return; 
                    }

                    if (unsubscribe) unsubscribe();

                    // Alert sukses otomatis saat disetujui Superadmin
                    if (currentRole === 'admin' && userData.isApproved === true) {
                        const sudahAlert = sessionStorage.getItem('alertApprovedDone');

                        if (!sudahAlert) {
        alert("Alhamdulillah ustadzah disetujui!");
        // Berikan tanda agar tidak muncul lagi sampai browser ditutup/login ulang
        sessionStorage.setItem('alertApprovedDone', 'true');
    }
}
                    
                    // SEMBUNYIKAN LOGIN, TAMPILKAN NAV
                    document.getElementById('loginSection').classList.add('d-none');
                    document.getElementById('mainNavbar').classList.remove('d-none');
                    
                    if (currentRole === 'admin' || currentRole === 'superadmin') {
                        showPage('admin');
                        await renderStudents();
                        await renderUstadzah();
                        if (loader) loader.classList.add('d-none');
                    } else {
                        showPage('parent');
                        await loadChildData(user.email);
                        await listenPaymentStatus(user.email);
                        if (loader) loader.classList.add('d-none');
                    }
                } else {
                    alert("Data user tidak ditemukan.");
                    await auth.signOut();
                    if (loader) loader.classList.add('d-none');
                }
            });

        } catch (error) {
            console.error("Error Auth:", error);
            if (loader) loader.classList.add('d-none');
        }
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

        alert("Login Gagal: " + msg);
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
    hideAllPages();
    
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
        labelNama.innerText = "Nama Santri (Identitas Resmi)";
        
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
                        : "Jilid " + jilidRaw;

    const avatar = userData.gender === 'Perempuan' ? 'https://i.imgur.com/NcNQ9R3.jpeg' : 'https://i.imgur.com/HPPr16Q.jpeg';

    // Masukkan HTML Kartu ke Container (Menggunakan "=" agar me-reset isi setiap update data)
    cardContainer.innerHTML = `
        <div class="card shadow-sm mb-4 border-0" style="border-radius: 15px; background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%); border-left: 5px solid #28a745;">
            <div class="card-body p-4 text-start">
                <div class="row align-items-center">
                    <div class="col-4 text-center">
                        <img src="${userData.photo || avatar}" class="rounded-circle shadow-sm" style="width: 85px; height: 85px; object-fit: cover; border: 3px solid #198754;">
                        <div class="mt-2">
                            <small class="text-muted d-block" style="font-size: 0.6rem; font-weight: bold;">NIS: ${userData.nis || '-'}</small>
                        </div>
                    </div>
                    <div class="col-5">
                        <h5 class="fw-bold mb-0 text-dark">${userData.name}</h5>
                        <small class="text-success fw-bold d-block mb-2">Otw Al-Qur'an! 📖</small>
                        <div class="progress" style="height: 8px; border-radius: 10px; background-color: #e9ecef;">
                            <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                                 role="progressbar" 
                                 style="width: ${progress}%" 
                                 aria-valuenow="${progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                        <div class="d-flex justify-content-between mt-1 small text-muted" style="font-size: 0.7rem;">
                            <span>${displayJilid}</span>
                            <span>Al-Qur'an</span>
                        </div>
                    </div>
                    <div class="col-3 text-center">
                        <div id="qrcode" class="bg-white p-1 d-inline-block shadow-sm" style="border-radius: 8px;"></div>
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
    const teacher = document.getElementById('stdTeacher').value;
    const parentEmail = document.getElementById('stdParentEmail').value;
    const parentPhone = document.getElementById('stdParentPhone').value;
    const photoFile = document.getElementById('stdPhoto').files[0];
    
    // Ambil nilai tanggal aktif dari input baru
    const joinDateValue = document.getElementById('stdJoinDate').value; 

    if (!joinDateValue && !id) {
        alert("Silakan isi tanggal aktif santri terlebih dahulu!");
        return;
    }

    let photoUrl = "";

    try {
        if (photoFile) {
            const storageRef = storage.ref(`students/${new Date().getTime()}_${photoFile.name}`);
            await storageRef.put(photoFile);
            photoUrl = await storageRef.getDownloadURL();
        }

        // Data dasar
        const studentData = {
            name, gender, class: sClass, jilid, teacher, parentEmail, parentPhone,
            joinDate: joinDateValue, // Simpan tanggal aktif ke database
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
        alert("Error: " + error.message);
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

    query.onSnapshot((snapshot) => {
        listDiv.innerHTML = '';
        if (notifList) notifList.innerHTML = ''; 
        let pendingCount = 0;

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
            <div class="list-group-item p-2 border-bottom bg-light" style="cursor: pointer;" onclick="tandaiDibaca('${id}', 'infaq')">
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
        <div class="list-group-item p-2 border-bottom" style="cursor: pointer;" onclick="tandaiDibaca('${id}', 'signature')">
            <div class="d-flex align-items-center">
                <div class="me-2 text-info"><i class="fas fa-file-signature fa-lg"></i></div>
                <div style="font-size: 0.75rem;">
                    <span class="badge bg-info text-white mb-1">TTD Baru</span><br>
                    <strong>${data.name}</strong><br>
                    <span class="text-muted" style="font-size: 0.65rem;">Klik untuk konfirmasi</span>
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
        <div class="d-flex align-items-center mb-3">
            <div style="width: 50px; height: 65px; overflow: hidden; border-radius: 5px; margin-right: 15px; border: 1px solid #ddd;">
                <img src="${data.photo || (data.gender === 'Perempuan' ? 'https://i.imgur.com/NcNQ9R3.jpeg' : 'https://i.imgur.com/HPPr16Q.jpeg')}" 
                     style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div>
                <h6 class="mb-0 fw-bold">${data.name}</h6>
                <p class="small text-muted mb-0">Kelas: ${data.class} | Guru: ${data.teacher}</p>
            </div>
        </div>

        <div class="mb-4 p-3 bg-light rounded border">
            <label class="form-label small fw-bold text-success"><i class="fas fa-envelope me-1"></i> Email Login Wali Santri</label>
            <input type="email" id="updateParentEmail" class="form-control form-control-sm" 
                   value="${data.parentEmail || ''}" placeholder="Masukkan email asli wali santri">
            <div class="form-text" style="font-size: 0.65rem;">Ganti email asli jika sudah ada</div>
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
    
    // Mengambil nilai dari dropdown jilid
    const levelValue = document.getElementById('studentLevel').value;
    
    let gradesObj = {};
    inputs.forEach(input => {
        gradesObj[input.dataset.subject] = input.value;
    });

    // Kita gunakan nama field 'jilid' agar sama dengan dashboard wali
    await db.collection('students').doc(id).update({
        grades: gradesObj,
        notes: notes,
        jilid: levelValue // <--- Nama field disamakan jadi 'jilid'
    });
    
    alert("Nilai dan Jilid berhasil disimpan!");
    const modal = bootstrap.Modal.getInstance(document.getElementById('gradeModal'));
    modal.hide();
}

// 5. Tagihan WA (Individual)
async function sendBillWA() {
    if (currentRole !== 'superadmin') {
        alert("Hanya Superadmin yang dapat mengirim tagihan.");
        return;
    }
    const id = document.getElementById('gradeStudentId').value;
    const doc = await db.collection('students').doc(id).get();
    const data = doc.data();

    if (!data.parentPhone) {
        alert("Nomor WhatsApp wali belum diisi.");
        return;
    }

    const message = `Assalamu'alaikum, Bapak/Ibu Wali Santri dari *${data.name}*. \n\nMohon bantuannya untuk pelunasan Infaq bulan ini sebesar *Rp 100.000*. \n\nPembayaran dapat melalui transfer atau tunai ke Ustadzah. Terima kasih.`;
    window.open(`https://wa.me/${data.parentPhone}?text=${encodeURIComponent(message)}`, '_blank');
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
            const avatarLaki = 'https://i.imgur.com/HPPr16Q.jpeg';
            const avatarPerempuan = 'https://i.imgur.com/NcNQ9R3.jpeg';
            const defaultAvatar = data.gender === 'Perempuan' ? avatarPerempuan : avatarLaki;

            document.getElementById('childPhotoDisplay').src = data.photo || defaultAvatar;
            document.getElementById('childNameDisplay').innerText = data.name;
            document.getElementById('childClassDisplay').innerText = data.class;

            let teksJilid = (data.jilid || "-").replace("Jilid ", "");
            document.getElementById('childJilidDisplay').innerText = "Jilid " + teksJilid;
            
            // --- B. Sinkronisasi Nilai Rapor Otomatis ---
            const reportDiv = document.getElementById('childReportCard');
if (reportDiv) {
    // 1. Buat variabel penampung agar tidak langsung "+=" ke HTML (mencegah double)
    let contentHtml = ''; 
    
    if (data.grades) {
        // Tampilkan Nilai (Struktur Asli Kakak)
        for (const [subj, grade] of Object.entries(data.grades)) {
            contentHtml += `
                <div class="grade-row d-flex justify-content-between border-bottom py-2">
                    <span>${subj}</span>
                    <span class="badge bg-primary badge-grade">${grade}</span>
                </div>`;
        }

        // Tampilkan Catatan (Struktur Asli Kakak)
        if(data.notes) {
            contentHtml += `<div class="mt-2 p-2 bg-light rounded"><small><strong>Catatan:</strong> ${data.notes}</small></div>`;
        }

        // AREA TTD (Struktur Asli Kakak - Digabung ke dalam contentHtml)
        const tglSekarang = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

contentHtml += `
<div id="signatureWrapper" class="mt-4">
    <div class="row text-center align-items-end g-0">
        <div class="col-4">
            <p class="small mb-0" style="font-size: 0.7rem;">Mengetahui,</p>
            <p class="small fw-bold mb-2" style="font-size: 0.75rem;">Kepala TPQ</p>
            <div style="min-height: 60px;" class="d-flex align-items-center justify-content-center">
                <img src="https://i.imgur.com/APp2Mt6.png" 
                     class="img-fluid" 
                     style="max-height: 50px; width: auto; max-width: 100%;">
            </div>
            <p class="small fw-bold mb-0" style="text-decoration: underline; font-size: 0.7rem;">Hafi Dzotur Rofi'ah, Lc.</p>
        </div>

        <div class="col-4">
            <p class="small mb-0" style="font-size: 0.7rem;">&nbsp;</p>
            <p class="small fw-bold mb-2" style="font-size: 0.75rem;">Wali Kelas</p>
            <div style="min-height: 60px;" class="d-flex align-items-center justify-content-center">
                <img src="https://i.imgur.com/pOg9hxn.png" 
                     class="img-fluid" 
                     style="max-height: 50px; width: auto; max-width: 100%;">
            </div>
            <p class="small fw-bold mb-0" style="text-decoration: underline; font-size: 0.7rem;">Salwa Kamilatuz Zakiyah</p>
        </div>

        <div class="col-4">
            <p class="small mb-1" style="font-size: 0.65rem;">Sidoarjo, ${tglSekarang}</p>
            <p class="small fw-bold mb-2" style="font-size: 0.75rem;">Wali Santri,</p>
            
            <div class="d-flex flex-column align-items-center">
                <div id="boxSignatureArea" style="min-height: 80px; width: 100%; max-width: 150px; border-radius: 5px;" class="mb-2">
                    </div>
                
                <p class="small fw-bold mb-0" style="font-size: 0.7rem; text-decoration: underline;">
                    ${data.parentName || "( Nama Wali Santri )"}
                </p>
            </div>
        </div>
</div>`;

        // 2. Masukkan semua isi ke reportDiv (Menggunakan "=" bukan "+=" agar reset setiap update)
        reportDiv.innerHTML = contentHtml;
        
        // 3. Jalankan pengecekan status TTD
        checkSignatureStatus(docSnap.id, data);

    } else {
        reportDiv.innerHTML = '<p class="text-muted text-center">Belum ada nilai laporan.</p>';
    }
}

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

        alert("Profil Berhasil Diperbarui!");
    } catch (error) {
        console.error(error);
        alert("Gagal menyimpan data: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save me-2"></i> ${originalText}`;
    }
}

function showRegisterModal() {
    new bootstrap.Modal(document.getElementById('registerModal')).show();
}

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
        alert("Pendaftaran Berhasil! Silakan Login.");
        window.location.reload();
    } catch (error) { alert("Gagal Daftar: " + error.message); }
});

const adminRegForm = document.getElementById('registerAdminForm');
if (adminRegForm) {
    adminRegForm.onsubmit = async function(e) {
        e.preventDefault();
        const nama = document.getElementById('regAdminNama').value;
        const email = document.getElementById('regAdminEmail').value;
        const password = document.getElementById('regAdminPassword').value;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(userCredential.user.uid).set({
                nama: nama, email: email, role: 'admin', isApproved: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("");
            location.reload();
        } catch (error) { alert("Gagal Daftar Admin: " + error.message); }
    };
}

async function renderUstadzah() {
    const listContainer = document.getElementById('ustadzahList');
    if (!listContainer) return;
    try {
        const snapshot = await db.collection('users').where('role', '==', 'admin').get();
        listContainer.innerHTML = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // --- LOGIKA FOTO AVATAR ---
            // Mengambil foto asli atau inisial jika photoURL kosong
            const linkFoto = data.photoURL || `https://ui-avatars.com/api/?name=${data.nama || 'U'}&background=random`;
            
            const deleteBtn = (currentRole === 'superadmin') 
                ? `<button class="btn btn-sm btn-outline-danger border-0" onclick="deleteUstadzah('${doc.id}', '${data.nama}')"><i class="bi bi-trash"></i> Hapus</button>` 
                : '';

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
                                <small class="text-muted" style="font-size: 0.75rem;">${data.email}</small>
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

async function deleteUstadzah(id, nama) {
    if (await confirm(`Hapus akun ${nama}?`)) {
        try {
            await db.collection('users').doc(id).delete();
            alert("Akun berhasil dihapus.");
            renderUstadzah();
        } catch (error) { alert(error.message); }
    }
}

async function deleteStudent(id, nama) {
    if (await confirm(`Hapus data santri: ${nama}?`)) {
        try {
            await db.collection('students').doc(id).delete();
            alert("Data santri berhasil dihapus.");
            renderStudents();
        } catch (error) { alert(error.message); }
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
        alert("Gagal membuat kuitansi. Pastikan koneksi internet stabil untuk memuat gambar.");
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
    if (!metode) return alert("Silakan pilih metode pembayaran terlebih dahulu.");

    // 1. MUNCULKAN LOADER (Sama dengan Login/Register)
    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('d-none');

    // Jeda 150ms agar browser stabil menampilkan loader sebelum proses berat
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

                // 2. PROSES GENERATE KUITANSI & ARSIP DRIVE
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
                // Matikan loader dulu agar visual kembali normal
                if (loader) loader.classList.add('d-none');

                // Beri pesan sukses (Tanpa kedip loader di belakang)
                alert("Konfirmasi berhasil! Ustadzah akan segera memverifikasi pembayaran Anda.");

                // Reload halaman secara halus setelah alert ditutup
                setTimeout(() => {
                    location.reload();
                }, 300);
            }
        } catch (error) {
            console.error("Master Error:", error);
            if (loader) loader.classList.add('d-none');
            alert("Terjadi kesalahan: " + error.message);
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
    if (!confirm(`Konfirmasi Pembayaran untuk ${nama}?`)) return;

    document.getElementById('loading').classList.remove('d-none');

    try {
        const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const d = new Date();
        const bulanSekarang = daftarBulan[d.getMonth()] + " " + d.getFullYear();

        const batch = db.batch();
        const studentRef = db.collection('students').doc(id);
        
        // Kita beri ID dokumen di riwayat sesuai nama bulan (agar mudah dihapus jika batal)
        const historyRef = studentRef.collection('payments').doc(bulanSekarang);

        batch.update(studentRef, {
            infaqStatus: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.set(historyRef, {
            amount: 100000, 
            month: bulanSekarang,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        alert(`Alhamdulillah, pembayaran ${nama} diverifikasi.`);

        if (typeof renderStudents === "function") await renderStudents();
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.classList.add('d-none');

    } catch (error) {
        alert("Gagal verifikasi: " + error.message);
    } finally {
        document.getElementById('loading').classList.add('d-none');
    }
}

async function batalkanVerifikasi(id, nama) {
    if (!confirm(`Batalkan status Lunas untuk ${nama}?`)) return;
    
    document.getElementById('loading').classList.remove('d-none');
    try {
        const daftarBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const d = new Date();
        const bulanSekarang = daftarBulan[d.getMonth()] + " " + d.getFullYear();

        const batch = db.batch();
        const studentRef = db.collection('students').doc(id);
        const historyRef = studentRef.collection('payments').doc(bulanSekarang);

        // 1. Kembalikan status ke false
        batch.update(studentRef, {
            infaqStatus: false,
            paymentMethod: firebase.firestore.FieldValue.delete(), 
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Hapus catatan riwayat bulan ini
        batch.delete(historyRef);

        await batch.commit();
        alert("Status " + nama + " dikembalikan ke BELUM LUNAS & Riwayat dihapus.");
        
        await renderStudents(); 
        
    } catch (error) {
        alert("Gagal membatalkan: " + error.message);
    } finally {
        document.getElementById('loading').classList.add('d-none');
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

        alert(`Status ${nama} berhasil dikembalikan ke Belum Lunas.`);
        
        // Refresh daftar agar kartu berubah warna
        renderStudents();

    } catch (error) {
        console.error("Gagal reset:", error);
        alert("Terjadi kesalahan: " + error.message);
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
        alert("Isi nama santri terlebih dahulu agar bisa dibuatkan email!");
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
    // Mencari data santri berdasarkan email wali
    db.collection('students')
        .where('parentEmail', '==', parentEmail)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                // Hanya jalankan jika data diubah (modified)
                if (change.type === "modified") {
                    const data = change.doc.data();
                    
                    // Jika status infaq berubah jadi true (Lunas/Dikonfirmasi)
                    if (data.infaqStatus === true) {
                        showPaymentToast();
                    }
                }
            });
        });
}

function showPaymentToast() {
    const toastEl = document.getElementById('paymentToast');
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
    
    // Opsional: Mainkan suara notifikasi pendek jika diinginkan
    // new Audio('notif-sound.mp3').play();
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

// --- FUNGSI TAMBAHAN UNTUK LOGIKA TTD ---
function checkSignatureStatus(studentId, data) {
    const area = document.getElementById('boxSignatureArea');
    if (!area) return;
    
    // Bersihkan area agar tidak dobel saat onSnapshot update
    area.innerHTML = '';

    if (data.reportSignature) {
        // Tampilan jika Wali Santri SUDAH tanda tangan
        area.innerHTML = `
            <div class="mt-2">
                <img src="${data.reportSignature}" style="height: 60px; width: auto; filter: contrast(150%);">
                <p class="small fw-bold mb-0 text-success" style="font-size: 10px;">
            </div>`;
    } else {
        // Tampilan jika Wali Santri BELUM tanda tangan (Muncul Canvas)
        area.innerHTML = `
            <canvas id="signature-pad" class="bg-white border rounded shadow-sm w-100" style="height: 80px; touch-action: none;"></canvas>
            <div class="d-flex gap-1 mt-2">
                <button class="btn btn-light btn-sm flex-grow-1" style="font-size: 9px; border: 1px solid #ddd;" onclick="clearSignature()">Hapus</button>
                <button class="btn btn-success btn-sm flex-grow-1" style="font-size: 9px;" onclick="saveSignature('${studentId}', '${data.name}')">Kirim TTD</button>
            </div>`;
        
        // Inisialisasi library SignaturePad pada canvas yang baru dibuat
        const canvas = document.getElementById('signature-pad');
        window.signaturePad = new SignaturePad(canvas);
    }
}

// Fungsi Menghapus Goresan TTD
function clearSignature() {
    if (window.signaturePad) window.signaturePad.clear();
}

// Fungsi Simpan TTD ke Firebase
async function saveSignature(studentId, studentName) {
    if (!window.signaturePad || window.signaturePad.isEmpty()) {
        return alert("Silakan bubuhkan tanda tangan terlebih dahulu.");
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

        alert("Alhamdulillah, tanda tangan berhasil terkirim!");
        // Jangan reload dulu agar data tersinkron sempurna
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal mengirim tanda tangan.");
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
        if (signaturePad.isEmpty()) return alert("Silakan tanda tangan terlebih dahulu.");

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

            alert("Tanda tangan berhasil dikirim!");
        } catch (err) {
            alert("Gagal mengirim TTD: " + err.message);
        }
    };

    window.clearSignature = () => signaturePad.clear();
}

async function resetTTD(studentId, studentName) {
    if (currentRole !== 'superadmin') {
        alert("Hanya Superadmin yang dapat mereset tanda tangan.");
        return;
    }
    // 1. Konfirmasi ke Ustadzah - DITAMBAHKAN 'await' agar tidak langsung tertimpa alert sukses
    const yakin = await confirm(`Apakah Anda yakin ingin menghapus tanda tangan dari ${studentName}?`);
    
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
            
            alert(`Tanda tangan ${studentName} berhasil dikosongkan!`);
        } catch (error) {
            console.error("Error reset TTD:", error);
            alert("Gagal mereset TTD: " + error.message);
        }
    }
}

async function tandaiDibaca(id, type) {
    try {
        if (type === 'signature') {
            // Jika diklik, kita anggap ustadzah sudah tahu. 
            // Agar hilang dari lonceng, kita bisa tambahkan marker di database
            await db.collection('students').doc(id).update({
                ttdNotifRead: true // Field penanda agar tidak muncul lagi di lonceng
            });
        } else if (type === 'infaq') {
            // Untuk infaq biasanya sekalian approve atau diarahkan ke fungsi approve
            approvePembayaran(id, "Santri");
        }
    } catch (error) {
        console.error("Error menandai dibaca:", error);
    }
}

async function forgotPassword() {
    const email = prompt("Masukkan Email terdaftar untuk reset password:");
    
    // Jika user menekan cancel atau tidak mengisi email
    if (!email) return;

    const loader = document.getElementById('loading');
    if (loader) loader.classList.remove('d-none');

    try {
        await auth.sendPasswordResetEmail(email);
        
        if (loader) loader.classList.add('d-none');
        alert("Link reset password telah dikirim ke email Anda. Silakan cek Inbox atau folder Spam.");
    } catch (error) {
        if (loader) loader.classList.add('d-none');
        
        let msg = "Gagal mengirim email reset.";
        if (error.code === 'auth/user-not-found') {
            msg = "Email tidak terdaftar!";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Format email salah!";
        }
        
        alert("Error: " + msg);
    }
}

function sendAlert(message, type = "info") {
  window.parent.postMessage(
    { type: "showAlert", text: message, alertType: type },
    "https://tpqalmubarokarc.blogspot.com"
  );
}




