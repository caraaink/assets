// ================== GOOGLE LENS CACHE ==================
let googleLensCache = null;        // Simpan hasil HTML Google Lens
let currentSearchImageUrl = null;  // Simpan imageUrl yang sedang digunakan
// ======================================================

async function fetchGoogleLens(imageUrl) {
  const lensSection = document.getElementById('google-lens-section');
  const lensContainer = document.getElementById('lens-results');

  lensSection.style.display = 'block';
  lensContainer.innerHTML = '<div style="padding:10px; color:#888; font-size:13px;">Memuat gambar serupa...</div>';

  const SEARCH_URL = atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L3NlYXJjaA==");
  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `imageUrl=${encodeURIComponent(imageUrl)}`
    });

    const html = await response.text();

    if (html && html.trim() !== '') {
      lensContainer.innerHTML = html;
      googleLensCache = html;        // Simpan hasil ke cache
    } else {
      lensSection.style.display = 'none';
      googleLensCache = null;
    }
  } catch (err) {
    console.warn('Google Lens gagal:', err.message);
    lensSection.style.display = 'none';
    googleLensCache = null;
  }
}

// Fungsi ketika user klik gambar dari Google Lens
async function useLensImage(selectedImageUrl) {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const lensSection = document.getElementById('google-lens-section');
  const lensResults = document.getElementById('lens-results');

  if (!resultBox || !resultList) return;

  // Simpan HTML Lens supaya tidak hilang
  const oldLensHTML = lensResults ? lensResults.innerHTML : '';

  // Reset detail sepenuhnya
  detailContent.innerHTML = '';
  detailContent.style.display = 'none';

  // Kembalikan tampilan ke mode list penuh (100%)
  resultList.style.display = 'block';
  resultList.style.flex = '1 1 100%';
  resultList.style.maxWidth = '100%';

  // Tampilkan loading
  resultList.innerHTML = `
    <div style="padding:40px 20px; text-align:center; color:#555;">
      <div class="more-info-loading" style="margin:0 auto; width:60px; height:60px;">
        <div class="spinner"></div>
      </div>
      <p style="margin-top:15px;">Mencari anime dengan gambar dari Google Lens...</p>
    </div>
  `;

  resultBox.style.display = 'block';
  resultBox.style.maxWidth = window.innerWidth <= 600 ? '500px' : '650px';

  try {
    // Jalankan pencarian ulang
    await performSearch(null, selectedImageUrl);

    // Setelah search selesai, pastikan Lens tetap muncul
    if (oldLensHTML && lensSection && lensResults) {
      setTimeout(() => {
        lensSection.style.display = 'block';
        lensResults.innerHTML = oldLensHTML;
      }, 400);
    }
  } catch (err) {
    console.error('Lens search failed:', err);
    resultList.innerHTML = `<p style="color:red; padding:20px; text-align:center;">Gagal melakukan pencarian.<br>${err.message}</p>`;
  }
}


// Cache for storing fetched moreInfo data
const moreInfoCache = new Map();

// Dynamic API base URL
const apiBaseUrl = window.location.origin;

// Fungsi untuk konversi detik ke HH:MM:SS
function formatTime(seconds) {
  const date = new Date(null);
  date.setSeconds(Math.floor(seconds));
  return date.toISOString().substr(11, 8);
}

// Fungsi untuk delay (digunakan untuk retry)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchMoreInfo(anilistId, retries = 2, backoff = 1000) {
  console.log('Fetching more info for AniList ID:', anilistId, 'Retries left:', retries);
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        trailer {
          id
          site
          thumbnail
        }
        staff(sort: RELEVANCE, page: 1, perPage: 5) {
          edges {
            role
            node {
              name {
                full
              }
              image {
                medium
              }
            }
          }
        }
        favourites
        popularity
        meanScore
        averageScore
        season
        seasonYear
        description(asHtml: false)
        characters(sort: FAVOURITES_DESC, page: 1, perPage: 5) {
          edges {
            node {
              name {
                full
              }
              image {
                medium
              }
            }
            voiceActors(language: JAPANESE) {
              name {
                full
              }
              image {
                medium
              }
            }
          }
        }
      }
    }
  `;
  const variables = { id: parseInt(anilistId) };

  try {
    const response = await fetch(atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L2FwaS9hbmlsaXN0"), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        console.warn(`Rate limit hit for AniList ID ${anilistId}, retrying after ${backoff}ms...`);
        await delay(backoff);
        return fetchMoreInfo(anilistId, retries - 1, backoff * 2);
      }
      throw new Error(`AniList API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AniList Response:', data);
    if (data.errors) throw new Error(data.errors[0].message);
    moreInfoCache.set(anilistId.toString(), data.data.Media);
    return data.data.Media;
  } catch (error) {
    console.error('More info fetch error for ID', anilistId, ':', error.message);
    if (retries > 0) {
      console.warn(`Retrying fetchMoreInfo for ID ${anilistId}, retries left: ${retries}`);
      await delay(backoff);
      return fetchMoreInfo(anilistId, retries - 1, backoff * 2);
    }
    return null;
  }
}

async function showDetail(id, videoUrl, filename, from, to, anilist, imageUrl, isMoreInfoFetch = false) {
  console.log('showDetail called with id:', id, 'videoUrl:', videoUrl, 'imageUrl:', imageUrl, 'isMoreInfoFetch:', isMoreInfoFetch);
  const detailContent = document.getElementById('detail-content');
  const searchResultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const lensSection = document.getElementById('google-lens-section');
  
  if (!detailContent) return;
  if (lensSection) {
      lensSection.style.display = 'none';   // Sembunyikan Google Lens saat buka detail
    }
  const title = anilist.title || {};
  const coverImage = anilist.coverImage ? anilist.coverImage.large : 'https://via.placeholder.com/100?text=Poster';

  // Highlight selected item
  document.querySelectorAll('.result-item').forEach(item => item.classList.remove('active'));
  const selectedItem = document.getElementById('result-' + id);
  if (selectedItem) selectedItem.classList.add('active');

  let moreInfo = moreInfoCache.get(anilist.id.toString()) || anilist.moreInfo || null;
  let moreInfoHTML = '';

  if (!moreInfo) {
    moreInfoHTML = `<div class="more-info-trigger" data-anilist-id="${anilist.id}">Lihat Info Selengkapnya</div>`;
  } else {
    const trailer = moreInfo.trailer;
    const trailerHTML = trailer && trailer.site === 'youtube' && trailer.id && trailer.thumbnail
      ? `<div id="more-info-content"><p><strong>Trailer:</strong></p><div class="trailer-link clickable" data-trailer="https://www.youtube.com/embed/${trailer.id}">
           <img src="${trailer.thumbnail}" alt="Trailer" loading="lazy">
           <span class="play-icon">▶︎</span>
         </div>`
      : '<p><strong>Trailer:</strong> Tidak ada trailer tersedia.</p>';

    const characters = moreInfo.characters && moreInfo.characters.edges.length > 0
      ? moreInfo.characters.edges.map(edge => {
          const characterName = edge.node.name.full;
          const voiceActor = edge.voiceActors[0]?.name.full || 'Tidak diketahui';
          const characterImage = edge.node.image?.medium || 'https://via.placeholder.com/50?text=No+Image';
          const vaImage = edge.voiceActors[0]?.image?.medium || 'https://via.placeholder.com/50?text=No+Image';
          return `<p>
            <img src="${characterImage}" alt="${characterName}" loading="lazy" class="clickable" data-fullsize="${characterImage}">
            <strong>${characterName}</strong>
            <span><img src="${vaImage}" alt="${voiceActor}" loading="lazy" class="clickable" data-fullsize="${vaImage}"> ${voiceActor}</span>
          </p>`;
        }).join('')
      : '<p>Tidak ada data karakter tersedia.</p>';

    const staff = moreInfo.staff && moreInfo.staff.edges.length > 0
      ? moreInfo.staff.edges.map(edge => {
          const staffName = edge.node.name.full;
          const staffRole = edge.role || 'Tidak diketahui';
          const staffImage = edge.node.image?.medium || null;
          return staffImage
            ? `<p><img src="${staffImage}" alt="${staffName}" loading="lazy" class="clickable" data-fullsize="${staffImage}"> <strong>${staffRole}</strong>: ${staffName}</p>`
            : `<p><strong>${staffRole}</strong>: ${staffName}</p>`;
        }).join('')
      : '<p>Tidak ada data staf tersedia.</p>';

    moreInfoHTML = `
      ${trailerHTML}
      <p><strong>Favorit:</strong> ${moreInfo.favourites || 'Tidak diketahui'}</p>
      <p><strong>Popularitas:</strong> ${moreInfo.popularity || 'Tidak diketahui'}</p>
      <p><strong>Skor Rata-rata:</strong> ${moreInfo.meanScore || 'Tidak diketahui'}/100</p>
      <p><strong>Musim:</strong> ${moreInfo.season && moreInfo.seasonYear ? `${moreInfo.season} ${moreInfo.seasonYear}` : 'Tidak diketahui'}</p>
      <p><strong>Sinopsis:</strong></p>
      <div class="synopsis">${moreInfo.description || 'Tidak ada sinopsis tersedia.'}</div>
      <p><strong>Pemeran Karakter:</strong></p>
      <div class="character-list">${characters}</div>
      <p><strong>Staf Produksi:</strong></p>
      <div class="staff-list">${staff}</div>
    `;
  }

  detailContent.innerHTML = `
    <div class="detail-section">
      <span class="detail-close" onclick="closeDetail()">✕</span>
      <div class="video-preview">
        ${videoUrl ? `
          <div class="video-wrapper">
            <div class="detail-preview ${videoUrl ? 'clickable' : ''}">
              <img src="${imageUrl || 'https://via.placeholder.com/300x169?text=Video'}" alt="preview" data-original="${videoUrl}">
              ${videoUrl ? '<span class="play-icon">▶︎</span>' : ''}
            </div>
          </div>
        ` : '<p>Tidak ada video preview.</p>'}

        <button id="tonton-full" class="tonton-btn">Tonton Full Episode</button>
      </div>
      <p class="filename-small">Filename: ${filename || 'Tidak diketahui'} | Waktu Scene: ${formatTime(from)} - ${formatTime(to)}</p>

      <hr>
      <div class="full-info">
        <img class="poster clickable" src="${coverImage}" alt="Poster" data-fullsize="${coverImage}">
        <p><strong>Judul Jepang:</strong> ${title.native || 'Tidak diketahui'}</p>
        <p><strong>Judul Romaji:</strong> ${title.romaji || 'Tidak diketahui'}</p>
        <p><strong>Judul Inggris:</strong> ${title.english || 'Tidak diketahui'}</p>
        <p><strong>Alias:</strong> ${anilist.synonyms ? anilist.synonyms.join(', ') : 'Tidak ada'}</p>
        <p><strong>Is Adult:</strong> ${anilist.isAdult ? 'Ya' : 'Tidak'}</p>
        <p><strong>Genre:</strong> ${anilist.genres ? anilist.genres.join(', ') : 'Tidak diketahui'}</p>
        <p><strong>Format:</strong> ${anilist.format || 'Tidak diketahui'}</p>
        <p><strong>Status:</strong> ${anilist.status || 'Tidak diketahui'}</p>
        <p><strong>Total Episodes:</strong> ${anilist.episodes || 'Tidak diketahui'}</p>
        <p><strong>Durasi per Episode:</strong> ${anilist.duration ? `${anilist.duration} menit` : 'Tidak diketahui'}</p>
        <p><strong>Tanggal Mulai:</strong> ${anilist.startDate ? `${anilist.startDate.year}-${anilist.startDate.month}-${anilist.startDate.day}` : 'Tidak diketahui'}</p>
        <p><strong>Tanggal Selesai:</strong> ${anilist.endDate ? `${anilist.endDate.year}-${anilist.endDate.month}-${anilist.endDate.day}` : 'Tidak diketahui'}</p>
        <p><strong>Studios:</strong> ${anilist.studios ? anilist.studios.edges.map(edge => edge.node.name).join(', ') : 'Tidak diketahui'}</p>
        <p><strong>Sumber:</strong> ${anilist.source || 'Tidak diketahui'}</p>
        <p><strong>Anilist ID:</strong> ${anilist.id ? `<a href="https://anilist.co/anime/${anilist.id}" target="_blank">${anilist.id}</a>` : 'Tidak diketahui'} 
           <strong>MAL ID:</strong> ${anilist.idMal ? `<a href="https://myanimelist.net/anime/${anilist.idMal}" target="_blank">${anilist.idMal}</a>` : 'Tidak diketahui'}</p>
        ${moreInfoHTML}
      </div>
    </div>
  `;

  // Tombol Tonton Full Episode
  const tontonBtn = detailContent.querySelector('#tonton-full');
  if (tontonBtn) {
    tontonBtn.style.cssText = 'display:block; margin:6px auto 2px auto; padding:4px 10px; font-size:10px; background-color:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;';
    
    tontonBtn.addEventListener('click', async () => {
      const malId = anilist.idMal;
      if (!malId) {
        tontonBtn.style.backgroundColor = 'gray';
        tontonBtn.textContent = 'ID MAL tidak ditemukan';
        return;
      }

      tontonBtn.textContent = 'Mengecek...';
      tontonBtn.disabled = true;

      try {
        const res = await fetch(`${window.location.origin}/check/${malId}`);
        const data = await res.json();

        if (data.code === 200) {
          tontonBtn.style.backgroundColor = 'green';
          tontonBtn.textContent = 'Tersedia! Mengarahkan...';
          setTimeout(() => window.location.href = window.location.origin + data.data, 3000);
        } else if (data.code === 404) {
          tontonBtn.style.backgroundColor = 'red';
          tontonBtn.textContent = 'Tidak tersedia di database';
        }
      } catch (err) {
        tontonBtn.style.backgroundColor = 'orange';
        tontonBtn.textContent = 'Gagal mengecek';
      } finally {
        tontonBtn.disabled = false;
      }
    });
  }

  // Pengaturan Split View Otomatis (50% Kiri : 50% Kanan)
  if (window.innerWidth <= 600) {
    resultList.style.display = 'none';
    detailContent.style.display = 'block';
    detailContent.style.maxWidth = '100%';
    searchResultBox.style.maxWidth = '500px';
  } else {
    detailContent.style.display = 'block';
    searchResultBox.style.maxWidth = '1050px'; // Lebarkan kotak saat split terbuka
    resultList.style.display = 'block';
    resultList.style.flex = '1 1 50%';
    resultList.style.maxWidth = '50%';
    detailContent.style.flex = '1 1 50%';
    detailContent.style.maxWidth = '50%';
  }

  // Scroll behavior
  setTimeout(() => {
    detailContent.scrollTop = isMoreInfoFetch && moreInfo ? 0 : 0;
  }, 100);

  // Event listeners untuk gambar dan video
  attachDetailEvents();
}

function attachDetailEvents() {
  const detailContent = document.getElementById('detail-content');

  // Preview video
  const detailPreview = detailContent.querySelector('.detail-preview.clickable');
  if (detailPreview) {
    detailPreview.addEventListener('click', function() {
      openModalVideo(this.querySelector('img').dataset.original);
    });
  }

  // Trailer
  const trailerLink = detailContent.querySelector('.trailer-link.clickable');
  if (trailerLink) {
    trailerLink.addEventListener('click', function() {
      openModalIframe(this.dataset.trailer);
    });
  }

  // Clickable images (poster, character, staff)
  detailContent.querySelectorAll('.poster.clickable, .character-list img.clickable, .staff-list img.clickable').forEach(img => {
    img.addEventListener('click', function() {
      openModalImage(this.dataset.fullsize);
    });
  });

  // More info trigger
  const moreInfoTrigger = detailContent.querySelector('.more-info-trigger');
  if (moreInfoTrigger) {
    moreInfoTrigger.addEventListener('click', async function() {
      const anilistId = this.dataset.anilistId;
      const loadingSpinner = document.createElement('div');
      loadingSpinner.className = 'more-info-loading';
      loadingSpinner.innerHTML = '<div class="spinner"></div>';
      this.insertAdjacentElement('beforebegin', loadingSpinner);
      this.style.display = 'none';

      const moreInfo = await fetchMoreInfo(anilistId);
      console.log('More info loaded for ID:', anilistId);
    });
  }
}

function openModalVideo(src) {
  const modal = document.getElementById('videoModal');
  const modalVideo = document.getElementById('modalVideo');
  modalVideo.style.display = 'block';
  modalVideo.querySelector('source').src = src;
  modalVideo.load();
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'block';
}

function openModalIframe(src) {
  const modal = document.getElementById('videoModal');
  const modalIframe = document.getElementById('modalIframe');
  modalIframe.style.display = 'block';
  modalIframe.src = src;
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'block';
}

function openModalImage(src) {
  const modal = document.getElementById('videoModal');
  const modalImage = document.getElementById('modalImage');
  modalImage.style.display = 'block';
  modalImage.src = src;
  document.getElementById('search-result-box').style.display = 'none';
  modal.style.display = 'block';
}

function closeDetail() {
  const detailContent = document.getElementById('detail-content');
  const resultList = document.getElementById('result-list');
  const searchResultBox = document.getElementById('search-result-box');
  const lensSection = document.getElementById('google-lens-section');

  detailContent.style.display = 'none';
  resultList.style.display = 'block';
  
  if (lensSection) {
    lensSection.style.display = 'block';
  }
  
  // Kembalikan ke mode list penuh (100%)
  if (window.innerWidth > 600) {
    searchResultBox.style.maxWidth = '650px';
    resultList.style.flex = '1 1 100%';
    resultList.style.maxWidth = '100%';
  }
  document.querySelectorAll('.result-item').forEach(item => item.classList.remove('active'));
}

function closeResultBox() {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const floatingFooter = document.getElementById('floating-footer');
  const fileInput = document.getElementById('file-short-anime');
  const imageUrlInput = document.getElementById('image-url');
  
  resultBox.style.display = 'none';
  resultList.innerHTML = '';
  resultList.style.flex = '1 1 100%';
  resultList.style.maxWidth = '100%';
  
  detailContent.innerHTML = '';
  detailContent.style.display = 'none';
  fileInput.value = '';
  imageUrlInput.value = '';
  floatingFooter.style.display = 'flex';

  moreInfoCache.clear();
  googleLensCache = null;
  currentSearchImageUrl = null;
}

document.getElementById('file-short-anime').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;

  const loading = document.getElementById('loading_file');
  const uploadIcon = document.querySelector('.upload-icon');
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const floatingFooter = document.getElementById('floating-footer');

  loading.style.display = 'block';
  if (uploadIcon) uploadIcon.style.display = 'none';
  resultList.innerHTML = '';
  detailContent.innerHTML = '';
  moreInfoCache.clear();
  googleLensCache = null;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'chat_meownime');
    formData.append('cloud_name', 'meownime');

    const res = await fetch(atob("aHR0cHM6Ly9hcGkuY2xvdWRpbmFyeS5jb20vdjFfMS9tZW93bmltZS9hdXRvL3VwbG9hZA=="), {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error(`Upload error: ${res.status}`);

    const data = await res.json();
    const imageUrl = data.secure_url;

    await performSearch(null, imageUrl);
  } catch (error) {
    console.error('Upload error:', error);
    resultList.innerHTML = `<p class="error">Gagal mengunggah gambar: ${error.message}</p>`;
  } finally {
    loading.style.display = 'none';
    if (uploadIcon) uploadIcon.style.display = 'block';
    this.value = '';
  }
});

function isValidImageLink(value) {
  return /^https?:\/\/\S+\.\S+/i.test(value);
}

function triggerSceneUrlSearch() {
  const urlInput = document.getElementById('image-url');
  const rawValue = urlInput ? urlInput.value.trim() : '';
  if (rawValue !== '' && isValidImageLink(rawValue)) {
    const loading = document.getElementById('loading_file');
    const uploadIcon = document.querySelector('.upload-icon');
    loading.style.display = 'block';
    if (uploadIcon) uploadIcon.style.display = 'none';
    moreInfoCache.clear();
    googleLensCache = null;
    performSearch(null, rawValue);
  } else {
    alert('Masukkan LINK / URL gambar yang valid (diawali http:// atau https://), bukan teks judul!\nUntuk pencarian dengan tulisan, gunakan kolom pencarian di bar situs paling atas.');
  }
}

document.getElementById('search-anime-btn').addEventListener('click', triggerSceneUrlSearch);

document.getElementById('image-url').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); triggerSceneUrlSearch(); }
});

async function performSearch(base64Image, imageUrl) {
  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  const detailContent = document.getElementById('detail-content');
  const loading = document.getElementById('loading_file');
  const uploadIcon = document.querySelector('.upload-icon');
  const floatingFooter = document.getElementById('floating-footer');

  resultList.innerHTML = '';
  detailContent.innerHTML = '';
  detailContent.style.display = 'none';
  resultBox.style.display = 'none';
  
  // Awal buka list: Lebar 100% rapi (tidak terbagi 50%)
  resultBox.style.maxWidth = window.innerWidth > 600 ? '650px' : '500px';
  resultList.style.flex = '1 1 100%';
  resultList.style.maxWidth = '100%';

  try {
    const params = new URLSearchParams();
    if (base64Image) params.append('image', base64Image);
    else if (imageUrl) params.append('url', imageUrl);
    
    params.append('anilistInfo', 1);
    params.append('cutBorders', 1);

    const TRACE_URL = atob("aHR0cHM6Ly9hcGkubWVvd25pbWUubmV0L2FwaS90cmFjZQ==");
    const response = await fetch(`${TRACE_URL}?${params.toString()}`, { method: 'GET' });

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const data = await response.json();

    if (data.result && data.result.length > 0) {
      const resultsWithMoreInfo = await Promise.all(data.result.map(async (result) => {
        const anilist = result.anilist || {};
        if (anilist.id && moreInfoCache.has(anilist.id.toString())) {
          anilist.moreInfo = moreInfoCache.get(anilist.id.toString());
        } else if (anilist.id) {
          const moreInfo = await fetchMoreInfo(anilist.id);
          if (moreInfo) anilist.moreInfo = moreInfo;
        }
        return { ...result, anilist };
      }));

      resultsWithMoreInfo.forEach((result, index) => {
        const anilist = result.anilist || {};
        const title = anilist.title || {};
        const anilistId = anilist.id || `unknown-${index}`;
        const hasVideo = result.video && result.video !== '';

        const previewDivHTML = `
          <div class="preview-media ${hasVideo ? 'clickable' : ''}">
            <img src="${result.image || 'https://via.placeholder.com/100?text=Video'}" height="100px" width="100px" alt="preview" ${hasVideo ? `data-original="${result.video}"` : ''}>
            ${hasVideo ? '<span class="play-icon">▶︎</span>' : ''}
          </div>
        `;

        resultList.innerHTML += `
          <div class="result-item" id="result-${anilistId}" data-id="${anilistId}" data-video="${result.video || ''}" data-filename="${result.filename || 'Tidak diketahui'}" data-from="${result.from}" data-to="${result.to}" data-anilist='${JSON.stringify(anilist).replace(/'/g, '&apos;')}' data-image="${result.image || ''}">
            <div class="summary-info">
              <div class="anime-title">${title.native || 'Tidak diketahui'}</div>
              <div class="anime-subtitle">${title.romaji || 'Tidak diketahui'}</div>
              <hr>
              <p class="episode">Episode: ${result.episode || 'Tidak diketahui'}</p>
              <p class="time">Waktu Scene: ${formatTime(result.from)} - ${formatTime(result.to)}</p>
              <p>Similarity: ${(result.similarity * 100).toFixed(2)}%</p>
            </div>
            ${previewDivHTML}
          </div>
        `;
      });

      attachResultEvents();

      setTimeout(() => {
        resultBox.style.display = 'block';
        floatingFooter.style.display = 'none';
      }, 100);

      if (imageUrl) {
        currentSearchImageUrl = imageUrl;
        if (!googleLensCache) {
          setTimeout(() => {
            fetchGoogleLens(imageUrl);
          }, 800);
        } else {
          setTimeout(() => {
            const lensSection = document.getElementById('google-lens-section');
            const lensContainer = document.getElementById('lens-results');
            lensSection.style.display = 'block';
            lensContainer.innerHTML = googleLensCache;
          }, 300);
        }
      }

    } else {
      resultList.innerHTML = '<p>Tidak ditemukan hasil yang cocok.</p>';
      setTimeout(() => {
        resultBox.style.display = 'block';
        floatingFooter.style.display = 'none';
      }, 100);
    }

  } catch (error) {
    console.error('Search error:', error);
    resultList.innerHTML = `<p class="error">Gagal mencari: ${error.message}, coba lagi (fitur ini hanya untuk pencarian anime berdasarkan link gambar atau unggah foto dari scene anime bukan pencarian keyword tulisan, gunakan pencarian di bar situs paling atas jika ingin mencari dengan tulisan) agar hasil lebih akurat gunakan foto rasionya 16:9 untuk lebih jelasnya bisa lihat tutor berikut <a href="https://www.dropbox.com/scl/fi/pt3phm9w8spvtivxs8whc/tutor.mp4?rlkey=mdrurqsh3d33m3lxn2yxk686p&st=qlom0qfk&dl=0" target="_blank">>>Lihat disini<<</a></p>`;
    floatingFooter.style.display = 'flex';
    setTimeout(() => resultBox.style.display = 'block', 100);
  } finally {
    if (loading) loading.style.display = 'none';
    if (uploadIcon) uploadIcon.style.display = 'block';
  }
}

function attachResultEvents() {
  document.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.preview-media')) return;
      const id = this.dataset.id;
      const videoUrl = this.dataset.video;
      const filename = this.dataset.filename;
      const from = parseFloat(this.dataset.from);
      const to = parseFloat(this.dataset.to);
      const anilist = JSON.parse(this.dataset.anilist.replace(/&apos;/g, "'"));
      const imageUrl = this.dataset.image;
      showDetail(id, videoUrl, filename, from, to, anilist, imageUrl, false);
    });
  });

  document.querySelectorAll('.preview-media.clickable img').forEach(img => {
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      openModalVideo(this.dataset.original);
    });
  });
}

document.addEventListener('click', function(e) {
  if (e.target.matches('.close-modal') || e.target.matches('.modal')) {
    const modal = document.getElementById('videoModal');
    modal.style.display = 'none';
    const modalVideo = document.getElementById('modalVideo');
    const modalIframe = document.getElementById('modalIframe');
    const modalImage = document.getElementById('modalImage');

    modalVideo.pause();
    if (modalVideo.querySelector('source')) {
      modalVideo.querySelector('source').src = '';
    }
    modalIframe.src = '';
    modalImage.src = '';

    if (document.getElementById('result-list').innerHTML) {
      document.getElementById('search-result-box').style.display = 'block';
    }
  }
});

function closeModal() {
  const modal = document.getElementById('videoModal');
  if (!modal) return;

  modal.style.display = 'none';

  const modalVideo = document.getElementById('modalVideo');
  const modalIframe = document.getElementById('modalIframe');
  const modalImage = document.getElementById('modalImage');

  if (modalVideo) {
    modalVideo.pause();
    modalVideo.style.display = 'none';
    if (modalVideo.querySelector('source')) {
      modalVideo.querySelector('source').src = '';
    }
    modalVideo.load();
  }

  if (modalIframe) {
    modalIframe.style.display = 'none';
    modalIframe.src = '';
  }

  if (modalImage) {
    modalImage.style.display = 'none';
    modalImage.src = '';
  }

  const resultBox = document.getElementById('search-result-box');
  const resultList = document.getElementById('result-list');
  
  if (resultBox && resultList && resultList.innerHTML.trim() !== '') {
    resultBox.style.display = 'block';
  }
}

document.addEventListener('click', function(e) {
  if (e.target.matches('.close-modal') || e.target.matches('.modal')) {
    closeModal();
  }
});

let sceneUserInteracted = false;
let sceneAutoTimer = null;
let currentWelcomeMode = 'welcome';

function lockSceneAutoSwitch() {
  sceneUserInteracted = true;
  if (sceneAutoTimer) { clearInterval(sceneAutoTimer); sceneAutoTimer = null; }
}

function toggleWelcomeSceneMode(fromUser) {
  if (fromUser) lockSceneAutoSwitch();
  currentWelcomeMode = (currentWelcomeMode === 'welcome') ? 'scene' : 'welcome';
  const panelDefault = document.getElementById('welcomeModeDefault');
  const panelScene = document.getElementById('welcomeModeScene');
  if (!panelDefault || !panelScene) return;
  panelDefault.style.display = (currentWelcomeMode === 'welcome') ? 'block' : 'none';
  panelScene.style.display = (currentWelcomeMode === 'scene') ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  const panelScene = document.getElementById('welcomeModeScene');
  if (!panelScene) return;

  sceneAutoTimer = setInterval(function() {
    if (!sceneUserInteracted) toggleWelcomeSceneMode(false);
  }, 5000);

  ['focusin', 'click', 'change', 'paste', 'input'].forEach(function(evt) {
    panelScene.addEventListener(evt, lockSceneAutoSwitch);
  });
});
