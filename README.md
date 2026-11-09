# Habita — Apartment Listing

Website katalog apartemen dengan halaman publik dan panel admin menggunakan Supabase untuk database, autentikasi admin, dan penyimpanan foto.

## File
- `index.html`: struktur halaman dan metadata SEO dasar.
- `style.css`: desain, layout, dan responsive styling.
- `ui-enhancements.css`: penyempurnaan visual, aksesibilitas, dan layout responsif.
- `app.js`: pencarian, filter, autentikasi admin Supabase, CRUD listing, upload foto, dan detail listing.
- `supabase-config.js`: URL proyek dan anon key Supabase untuk frontend.
- `supabase-setup.sql`: skema tabel serta kebijakan akses database dan bucket Storage.

## Menyiapkan Supabase
1. Buat proyek di [Supabase](https://supabase.com/).
2. Buka **SQL Editor**, lalu jalankan seluruh isi `supabase-setup.sql`.
3. Buka **Project Settings → API** dan salin Project URL serta `anon`/publishable key ke `supabase-config.js`.
4. Di **Authentication → Users**, buat akun admin. Nonaktifkan pendaftaran publik di pengaturan **Authentication** agar pengunjung tidak bisa membuat akun sendiri.
5. Jalankan situs melalui Live Server atau hosting web statis.

Frontend hanya menggunakan anon/publishable key; jangan pernah menaruh `service_role` key di file situs. Kebijakan RLS membolehkan publik membaca listing dan foto, sementara operasi tulis mewajibkan pengguna terautentikasi. Karena itu, situs ini cocok untuk konten listing yang memang publik.

Jika tabel listing sudah pernah dibuat, jalankan kembali seluruh `supabase-setup.sql` setelah pembaruan fitur untuk menambahkan kolom pilihan transaksi dan periode sewa tanpa menghapus data lama. Listing lama otomatis dianggap sebagai jual.

## Deploy GitHub Pages
Upload seluruh isi folder ini ke root repository. Pastikan `index.html` berada di root. Lalu buka Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.

Pastikan `supabase-config.js` sudah diisi sebelum deploy. Jangan unggah kredensial selain anon/publishable key.
