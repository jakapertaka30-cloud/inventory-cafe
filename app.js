const STORAGE_BUCKET = "apartment-photos";
const config = window.SUPABASE_CONFIG || {};
const configured = Boolean(
  config.url &&
  config.anonKey &&
  !config.url.includes("YOUR_SUPABASE") &&
  !config.anonKey.includes("YOUR_SUPABASE")
);
let supabaseClient = null;
let initializationError = "";
if (configured) {
  if (!window.supabase) {
    initializationError = "Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.";
  } else {
    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    } catch (error) {
      initializationError = "Konfigurasi Supabase tidak valid: " + error.message;
    }
  }
}

let units = [];
let pendingPhotos = [];
let currentUser = null;
let toastTimer;

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function photo(unit) {
  return unit.photos?.[0] || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80";
}

function formatListingPrice(unit) {
  const suffix = unit.transaction_type === "Sewa"
    ? unit.rent_period === "year" ? "/tahun" : "/bulan"
    : "";
  return rupiah(unit.price) + suffix;
}

function setNotice(id, message) {
  document.getElementById(id).textContent = message;
}

function animateEntry(element) {
  element.classList.remove("view-enter");
  requestAnimationFrame(() => element.classList.add("view-enter"));
  const finishEntry = event => {
    if (event.target !== element) return;
    element.classList.remove("view-enter");
    element.removeEventListener("animationend", finishEntry);
  };
  element.addEventListener("animationend", finishEntry);
}

function updateNavigation(activePage) {
  document.getElementById("navListings").setAttribute("aria-current", activePage === "public" ? "page" : "false");
  document.getElementById("navAdmin").setAttribute("aria-current", activePage === "admin" ? "page" : "false");
}

function renderListings() {
  const query = (document.getElementById("searchInput").value || "").toLowerCase();
  const type = document.getElementById("typeFilter").value || "";
  const transaction = document.getElementById("transactionFilter").value || "";
  const filtered = units.filter(unit =>
    (unit.name + " " + unit.unit + " " + (unit.location || "")).toLowerCase().includes(query) &&
    (!transaction || (unit.transaction_type || "Jual") === transaction) &&
    (!type || unit.type === type)
  );

  document.getElementById("listingCount").textContent = filtered.length + " unit ditemukan";
  document.getElementById("listingGrid").innerHTML = filtered.length
    ? filtered.map(unit => `<article class="card"><div class="photo"><img src="${esc(photo(unit))}" alt="${esc(unit.name)}" onerror="this.src='https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80'"><span class="status ${unit.status === "Sold" || unit.status === "Rented" ? "sold" : ""}">${esc(unit.status)}</span><span class="photo-count">▧ ${unit.photos?.length || 0} foto</span></div><div class="cardbody"><div class="location">⌖ ${esc(unit.location || "Lokasi belum diisi")}</div><h3>${esc(unit.name)}</h3><div class="unit">${esc(unit.unit)} · ${esc(unit.type)}</div><span class="listing-badge">${esc(unit.transaction_type || "Jual")}</span><div class="price">${formatListingPrice(unit)}</div><div class="specs"><span>▱ ${esc(unit.area)} m²</span><span>▣ ${esc(unit.bedrooms ?? "-")} KT</span><span>▤ ${esc(unit.bathrooms ?? "-")} KM</span></div><div class="cardfoot"><span class="unit">${esc(unit.furnishing || "")}</span><button class="detailbtn" onclick="showDetail('${esc(unit.id)}')">Lihat detail →</button></div></div></article>`).join("")
    : `<div class="empty"><div style="font-size:32px;margin-bottom:10px">⌕</div><b>${units.length ? "Unit tidak ditemukan" : "Belum ada listing"}</b><p>${units.length ? "Coba ubah kata kunci atau filter pencarian." : "Listing yang tersedia akan muncul di sini."}</p></div>`;
  document.querySelectorAll("#listingGrid .card").forEach((card, index) => {
    card.style.setProperty("--card-index", Math.min(index, 7));
    card.classList.add("card-enter");
  });
}

function searchListings() {
  renderListings();
  document.getElementById("publicPage").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPublic(scrollToListings) {
  const wasPublic = document.getElementById("adminPage").style.display === "none";
  document.getElementById("adminPage").style.display = "none";
  document.getElementById("publicPage").style.display = "block";
  document.getElementById("hero").style.display = "block";
  if (!wasPublic) {
    animateEntry(document.getElementById("hero"));
    animateEntry(document.getElementById("publicPage"));
  }
  updateNavigation("public");
  renderListings();
  if (scrollToListings) {
    searchListings();
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function openAdmin() {
  if (!supabaseClient) {
    toast(initializationError || "Isi URL dan anon key Supabase di supabase-config.js terlebih dahulu.");
    return;
  }
  if (currentUser) {
    showAdmin();
    return;
  }
  openModal("loginModal", "adminEmail");
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    toast("Login gagal: " + error.message);
    return;
  }

  currentUser = data.user;
  closeModal("loginModal");
  document.getElementById("adminPassword").value = "";
  showAdmin();
}

async function logoutAdmin() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    toast("Gagal keluar: " + error.message);
    return;
  }
  currentUser = null;
  showPublic();
}

function showAdmin() {
  const wasAdmin = document.getElementById("adminPage").style.display === "block";
  document.getElementById("hero").style.display = "none";
  document.getElementById("publicPage").style.display = "none";
  document.getElementById("adminPage").style.display = "block";
  if (!wasAdmin) animateEntry(document.getElementById("adminPage"));
  updateNavigation("admin");
  renderAdmin();
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadListings();
}

function renderAdmin() {
  document.getElementById("totalStat").textContent = units.length;
  document.getElementById("availableStat").textContent = units.filter(unit => unit.status === "Available").length;
  document.getElementById("soldStat").textContent = units.filter(unit => unit.status === "Sold" || unit.status === "Rented").length;
  document.getElementById("adminRows").innerHTML = units.length
    ? units.map(unit => `<tr><td><img class="tableimg" src="${esc(photo(unit))}" alt=""><strong style="display:inline">${esc(unit.name)}</strong><div class="hint" style="margin-left:66px">${esc(unit.unit)}</div></td><td>${esc(unit.type)}</td><td>${esc(unit.transaction_type || "Jual")}</td><td>${esc(unit.area)} m²</td><td>${formatListingPrice(unit)}</td><td><span class="status ${unit.status === "Sold" || unit.status === "Rented" ? "sold" : ""}" style="position:static;display:inline-block">${esc(unit.status)}</span></td><td><div class="actions"><button class="smallbtn" onclick="editUnit('${esc(unit.id)}')">Edit</button><button class="smallbtn delete" onclick="deleteUnit('${esc(unit.id)}')">Hapus</button></div></td></tr>`).join("")
    : `<tr><td colspan="7" style="text-align:center;color:#718096;padding:35px">Belum ada unit. Klik Tambah Unit untuk memulai.</td></tr>`;
}

async function loadListings() {
  if (!supabaseClient) {
    const message = initializationError || "Hubungkan proyek Supabase dengan mengisi URL dan anon key pada supabase-config.js.";
    setNotice("connectionNotice", message);
    setNotice("adminNotice", message);
    renderListings();
    renderAdmin();
    return;
  }

  setNotice("connectionNotice", "Memuat listing...");
  const { data, error } = await supabaseClient
    .from("apartments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    const message = "Gagal memuat data Supabase: " + error.message;
    setNotice("connectionNotice", message);
    setNotice("adminNotice", message);
    toast(message);
    return;
  }

  units = data || [];
  setNotice("connectionNotice", "");
  setNotice("adminNotice", "Data listing tersinkron dengan Supabase.");
  renderListings();
  renderAdmin();
}

function openForm() {
  if (!currentUser) {
    toast("Silakan masuk sebagai admin untuk mengelola listing.");
    return;
  }
  document.getElementById("unitForm").reset();
  document.getElementById("editId").value = "";
  pendingPhotos = [];
  document.getElementById("photoPreview").innerHTML = "";
  document.getElementById("formTitle").textContent = "Tambah Unit";
  document.getElementById("transactionType").value = "Jual";
  updateTransactionFields();
  openModal("formModal", "name");
}

function editUnit(id) {
  const unit = units.find(item => item.id === id);
  if (!unit) return;

  openForm();
  document.getElementById("formTitle").textContent = "Edit Unit";
  document.getElementById("editId").value = id;
  ["name", "unit", "type", "area", "bedrooms", "bathrooms", "floor", "furnishing", "price", "status", "location", "certificate", "description"]
    .forEach(key => { document.getElementById(key).value = unit[key] ?? ""; });
  document.getElementById("transactionType").value = unit.transaction_type || "Jual";
  document.getElementById("rentPeriod").value = unit.rent_period || "month";
  updateTransactionFields();
  document.getElementById("status").value = unit.status || "Available";
  pendingPhotos = (unit.photos || []).map(url => ({ url, file: null }));
  drawPreview();
}

function updateTransactionFields() {
  const isRental = document.getElementById("transactionType").value === "Sewa";
  const previousStatus = document.getElementById("status").value;
  document.getElementById("rentPeriodField").style.display = isRental ? "" : "none";
  document.getElementById("rentPeriod").required = isRental;
  document.getElementById("priceLabel").textContent = isRental ? "Harga sewa (Rp) *" : "Harga jual (Rp) *";
  document.getElementById("price").placeholder = isRental ? "5000000" : "1250000000";

  const status = document.getElementById("status");
  if (isRental) {
    status.innerHTML = '<option>Available</option><option>Rented</option>';
  } else {
    status.innerHTML = '<option>Available</option><option>Sold</option>';
  }
  status.value = isRental
    ? previousStatus === "Rented" ? "Rented" : "Available"
    : previousStatus === "Sold" ? "Sold" : "Available";
}

document.getElementById("photos").addEventListener("change", event => {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    if (!file.type.startsWith("image/")) {
      toast("File " + file.name + " bukan gambar.");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      toast("Foto " + file.name + " melebihi 2,5 MB.");
      return;
    }
    pendingPhotos.push({ url: URL.createObjectURL(file), file });
  });
  drawPreview();
  event.target.value = "";
});

function drawPreview() {
  document.getElementById("photoPreview").innerHTML = pendingPhotos
    .map((item, index) => `<div style="position:relative"><img src="${esc(item.url)}" alt="Preview"><button type="button" onclick="removePhoto(${index})" aria-label="Hapus foto" style="position:absolute;right:-5px;top:-5px;border:0;border-radius:50%;background:#172235;color:#fff;width:20px;height:20px">×</button></div>`)
    .join("");
}

function removePhoto(index) {
  const [removed] = pendingPhotos.splice(index, 1);
  if (removed?.file) URL.revokeObjectURL(removed.url);
  drawPreview();
}

function val(id) {
  return document.getElementById(id).value.trim();
}

function storagePathFromUrl(url) {
  const prefix = config.url + "/storage/v1/object/public/" + STORAGE_BUCKET + "/";
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

async function removeStoredPhotos(urls) {
  const paths = urls.map(storagePathFromUrl).filter(Boolean);
  if (!paths.length) return;
  const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) throw error;
}

async function saveUnit(event) {
  event.preventDefault();
  const submitButton = event.submitter;
  if (submitButton) submitButton.disabled = true;

  const id = document.getElementById("editId").value;
  const previous = units.find(unit => unit.id === id);
  const uploadedPaths = [];
  const photos = [];
  let cleanupWarning = "";

  try {
    for (const item of pendingPhotos) {
      if (!item.file) {
        photos.push(item.url);
        continue;
      }

      const filename = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = crypto.randomUUID() + "-" + filename;
      const { error: uploadError } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, item.file, {
          cacheControl: "3600",
          contentType: item.file.type,
          upsert: false
        });
      if (uploadError) throw uploadError;

      uploadedPaths.push(path);
      const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      photos.push(data.publicUrl);
    }

    const listing = {
      name: val("name"),
      unit: val("unit"),
      type: val("type"),
      transaction_type: val("transactionType"),
      rent_period: val("transactionType") === "Sewa" ? val("rentPeriod") : null,
      area: Number(val("area")),
      bedrooms: Number(val("bedrooms") || 0),
      bathrooms: Number(val("bathrooms") || 0),
      floor: val("floor"),
      furnishing: val("furnishing"),
      price: Number(val("price")),
      status: val("status"),
      location: val("location"),
      certificate: val("certificate"),
      description: val("description"),
      photos
    };

    const result = id
      ? await supabaseClient.from("apartments").update(listing).eq("id", id).select().single()
      : await supabaseClient.from("apartments").insert(listing).select().single();
    if (result.error) throw result.error;

    units = id
      ? units.map(unit => unit.id === id ? result.data : unit)
      : [result.data, ...units];

    const removedPhotos = (previous?.photos || []).filter(url => !photos.includes(url));
    try {
      await removeStoredPhotos(removedPhotos);
    } catch (cleanupError) {
      cleanupWarning = " Foto lama gagal dibersihkan: " + cleanupError.message;
    }

    pendingPhotos.forEach(item => {
      if (item.file) URL.revokeObjectURL(item.url);
    });
    pendingPhotos = [];
    closeModal("formModal");
    renderAdmin();
    renderListings();
    toast("Data unit berhasil disimpan." + cleanupWarning);
  } catch (error) {
    let uploadCleanupWarning = "";
    if (uploadedPaths.length) {
      try {
        const { error: cleanupError } = await supabaseClient.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
        if (cleanupError) throw cleanupError;
      } catch (cleanupError) {
        uploadCleanupWarning = ". Foto sementara juga gagal dibersihkan: " + cleanupError.message;
      }
    }
    toast("Gagal menyimpan listing: " + error.message + uploadCleanupWarning);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteUnit(id) {
  const unit = units.find(item => item.id === id);
  if (!unit || !confirm("Hapus listing " + unit.name + " — " + unit.unit + "?")) return;

  const { error } = await supabaseClient.from("apartments").delete().eq("id", id);
  if (error) {
    toast("Gagal menghapus listing: " + error.message);
    return;
  }

  units = units.filter(item => item.id !== id);
  renderAdmin();
  renderListings();
  try {
    await removeStoredPhotos(unit.photos || []);
    toast("Listing dan fotonya berhasil dihapus.");
  } catch (cleanupError) {
    toast("Listing terhapus, tetapi sebagian foto gagal dihapus: " + cleanupError.message);
  }
}

function showDetail(id) {
  const unit = units.find(item => item.id === id);
  if (!unit) return;

  const images = (unit.photos || []).slice(0, 3);
  document.getElementById("detailContent").innerHTML = `<img class="detailhero" src="${esc(photo(unit))}" alt="${esc(unit.name)}">${images.length > 1 ? `<div class="detailgallery">${images.slice(1).map(url => `<img src="${esc(url)}" alt="Foto unit">`).join("")}</div>` : ""}<div class="detailinfo"><div class="location">${esc(unit.location || "Lokasi belum diisi")} · <span class="status ${unit.status === "Sold" || unit.status === "Rented" ? "sold" : ""}" style="position:static;display:inline-block">${esc(unit.status)}</span></div><h2>${esc(unit.name)}</h2><div class="unit">${esc(unit.unit)} · ${esc(unit.type)}</div><span class="listing-badge">${esc(unit.transaction_type || "Jual")}</span><div class="detailprice">${formatListingPrice(unit)}</div><div class="detailgrid">${[["Jenis transaksi", unit.transaction_type || "Jual"], ...(unit.transaction_type === "Sewa" ? [["Periode sewa", unit.rent_period === "year" ? "Per tahun" : "Per bulan"]] : []), ["Luas", unit.area + " m²"], ["Kamar tidur", unit.bedrooms], ["Kamar mandi", unit.bathrooms], ["Lantai", unit.floor || "-"], ["Furnitur", unit.furnishing || "-"], ["Sertifikat", unit.certificate || "-"]].map(item => `<div class="detailcell"><small>${item[0]}</small><b>${esc(item[1])}</b></div>`).join("")}</div><h4>Deskripsi</h4><p style="line-height:1.7;color:#5f6d80;font-size:14px">${esc(unit.description || "Belum ada deskripsi.")}</p></div>`;
  openModal("detailModal");
}

function openModal(id, focusId) {
  const modal = document.getElementById(id);
  modal.classList.remove("closing");
  modal.classList.add("show");
  if (focusId) {
    requestAnimationFrame(() => document.getElementById(focusId).focus());
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal.classList.contains("show") || modal.classList.contains("closing")) return;
  modal.classList.add("closing");
  const finishClose = event => {
    if (event && event.target !== modal) return;
    modal.classList.remove("show", "closing");
    modal.removeEventListener("animationend", finishClose);
    clearTimeout(modal.closeTimer);
  };
  modal.addEventListener("animationend", finishClose);
  modal.closeTimer = setTimeout(finishClose, 300);
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 3500);
}

document.querySelectorAll(".modalback").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const openModalElement = document.querySelector(".modalback.show:not(.closing)");
  if (openModalElement) closeModal(openModalElement.id);
});

document.getElementById("year").textContent = new Date().getFullYear();
updateNavigation("public");
renderListings();

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (!currentUser && document.getElementById("adminPage").style.display === "block") {
      showPublic();
    }
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      setNotice("connectionNotice", "Gagal memeriksa sesi admin: " + error.message);
      return;
    }
    currentUser = data.session?.user || null;
    loadListings();
  });
} else {
  loadListings();
}
