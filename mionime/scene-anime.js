/* Mionime - Cari Anime dari Cuplikan Scene */
/* ---- UI welcome container / input ---- */
.welcome-scene-host{position:relative}
.scene-mode-toggle{position:absolute;top:10px;right:10px;width:32px;height:32px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-muted);border-radius:50%;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease;z-index:5}
.scene-mode-toggle:hover{background:var(--primary);border-color:var(--primary);color:#fff;transform:rotate(180deg)}
.welcome-mode-panel{animation:sceneFadeIn .35s ease}
@keyframes sceneFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.floating-footer{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:620px;margin:14px auto 0;padding:0;text-align:left}
.file-input-wrapper{display:flex;align-items:center}
#image-url{flex:1;min-width:0;background:var(--bg-body);border:1px solid var(--border);color:var(--text-main);padding:9px 14px;border-radius:20px;font-size:13px;outline:none;transition:border-color .2s}
#image-url:focus{border-color:var(--primary)}
#image-url::placeholder{color:var(--text-muted);opacity:.7}
.scene-upload-icon i{color:var(--primary);font-size:22px;cursor:pointer;transition:transform .2s}
.scene-upload-icon:hover i{transform:scale(1.12)}
#loading_file{display:none;padding:2px}
.scene-mini-spinner{width:20px;height:20px;border:3px solid rgba(255,255,255,.15);border-top:3px solid var(--primary);border-radius:50%;animation:spin 1s linear infinite}
button#search-anime-btn{padding:9px 16px;background:var(--primary);color:#fff;border:none;border-radius:20px;cursor:pointer;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:opacity .2s,transform .2s}
button#search-anime-btn:hover{opacity:.88;transform:translateY(-1px)}
button#search-anime-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
/* ---- Result box (tema gelap situs) ---- */
.search-result-box{display:none;flex-direction:column;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-card);color:var(--text-main);border:1px solid rgba(255,255,255,.25);border-radius:10px;box-shadow:0 10px 35px rgba(0,0,0,.6);max-height:80vh;width:95%;z-index:1001;overflow:hidden}
.search-result-header{display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:var(--bg-navbar);border-bottom:2px solid rgba(255,255,255,.18);flex-shrink:0;z-index:1002}
.search-result-header h3{margin:0;font-size:15px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px}
.srh-right{display:flex;align-items:center;gap:10px}
.srh-brand{font-size:11px;color:var(--text-muted)}
.close-btn{background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;transition:color .2s}
.close-btn:hover{color:var(--primary)}
.lens-section{display:none;flex-shrink:0;padding:12px 15px 10px;border-bottom:1px solid var(--border)}
.lens-results{overflow:auto;white-space:nowrap;-ms-overflow-style:none;scrollbar-width:none;padding-bottom:5px;overscroll-behavior:contain}
#lens-results img{transition:outline-color .2s,opacity .2s}
#lens-results img.lens-selected{outline:2px solid var(--primary);outline-offset:2px;border-radius:6px}
#search-result-content{flex:1 1 auto;min-height:0;padding:10px 15px;overflow-y:auto;box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#555 var(--bg-body);overflow-anchor:none;overscroll-behavior:contain}
#result-list{flex:1;min-height:0;overflow-y:auto;overflow-anchor:none;overscroll-behavior:contain}
#detail-content{flex:1;min-height:0;max-width:550px;display:none;padding-left:15px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#555 var(--bg-body);overflow-anchor:none;overscroll-behavior:contain}
#detail-content::-webkit-scrollbar,#search-result-content::-webkit-scrollbar{width:8px}
#detail-content::-webkit-scrollbar-track,#search-result-content::-webkit-scrollbar-track{background:var(--bg-body);border-radius:4px}
#detail-content::-webkit-scrollbar-thumb,#search-result-content::-webkit-scrollbar-thumb{background:#555;border-radius:4px}
#detail-content::-webkit-scrollbar-thumb:hover,#search-result-content::-webkit-scrollbar-thumb:hover{background:#777}
/* ---- Item hasil ---- */
.result-item{margin-bottom:15px;padding:10px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:background-color .2s,border-color .2s;overflow:hidden}
.result-item:hover{background:rgba(255,255,255,.05)}
.result-item.active{background:rgba(244,63,94,.1);border-color:var(--primary);box-shadow:inset 3px 0 0 var(--primary)}
.summary-info{display:inline-block;width:calc(100% - 120px)}
.summary-info hr{border:none;border-top:1px dashed var(--border);margin:6px 0}
.summary-info p{margin:4px 0;font-size:12.5px}
.anime-title{font-size:.95em;font-weight:bold;color:var(--text-main)}
.anime-subtitle{color:var(--text-muted);font-style:italic;font-size:12px}
.episode{color:var(--primary);font-weight:700}
.time{color:var(--accent)}
.error{color:var(--primary)}
.error a{color:var(--accent);font-weight:700}
/* ---- Preview & media ---- */
.preview-media,.trailer-link,.detail-preview{position:relative;display:inline-block;margin:10px 0}
.preview-media img,.trailer-link img{display:block;width:100px;height:100px;object-fit:cover;border-radius:6px;transition:transform .2s}
.detail-preview img{width:100%;max-width:300px;height:auto;aspect-ratio:16/9;border-radius:6px;transition:transform .2s}
.preview-media.clickable img,.trailer-link.clickable img,.detail-preview.clickable img,.poster.clickable,.character-list img.clickable,.staff-list img.clickable{cursor:pointer}
.preview-media.clickable:hover img,.trailer-link.clickable:hover img,.detail-preview.clickable:hover img,.poster.clickable:hover,.character-list img.clickable:hover,.staff-list img.clickable:hover{transform:scale(1.05)}
.preview-media:not(.clickable) img,.trailer-link:not(.clickable) img,.detail-preview:not(.clickable) img,.poster:not(.clickable),.character-list img:not(.clickable),.staff-list img:not(.clickable){cursor:default}
.play-icon{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;color:#fff;background:rgba(0,0,0,.6);padding:8px;border-radius:50%;display:none;pointer-events:none}
.preview-media.clickable:hover .play-icon,.trailer-link.clickable:hover .play-icon,.detail-preview.clickable:hover .play-icon{display:block}
.video-preview{text-align:center;position:relative}
.video-wrapper{position:relative;width:100%;max-width:300px;margin:0 auto;aspect-ratio:16/9;overflow:hidden;border-radius:6px}
/* ---- Detail info (dikelompokkan biar tidak mepet) ---- */
.detail-section{position:relative}
.detail-close{position:sticky;top:6px;float:right;color:var(--primary);font-size:22px;line-height:1;cursor:pointer;z-index:2500}
.detail-group{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:12px;clear:both}
.detail-group p{margin:5px 0;line-height:1.55;font-size:13px}
.detail-group p strong{color:var(--text-muted)}
.detail-group a{color:var(--accent);font-weight:600}
.detail-group-title{font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--primary);border-bottom:1px dashed var(--border);padding-bottom:6px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.tonton-btn{display:block;margin:8px auto 2px;padding:6px 14px;font-size:11px;font-weight:700;background:#0284c7;color:#fff;border:none;border-radius:5px;cursor:pointer;transition:opacity .2s}
.tonton-btn:hover{opacity:.88}
.tonton-btn:disabled{opacity:.6;cursor:default}
.filename-small{font-size:.78em;color:var(--text-muted);text-align:center;margin-top:6px}
.full-info{overflow:hidden}
.poster-frame{float:left;margin:0 10px 6px 0;width:100px;aspect-ratio:2/3;background:rgba(255,255,255,.04);border-radius:6px;border:1px solid var(--border);overflow:hidden}
.poster{display:block;width:100%;height:100%;object-fit:cover}
.synopsis{max-height:150px;overflow-y:auto;padding-right:5px;font-size:13px;line-height:1.6;color:#cbd5e1;scrollbar-width:thin;scrollbar-color:#555 var(--bg-body);overscroll-behavior:contain}
.character-list p{margin:6px 0;display:grid;grid-template-columns:50px 1fr 1fr;align-items:center;gap:10px;font-size:13px}
.character-list p > strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.character-list p > span{display:flex;align-items:center;gap:8px;min-width:0}
.character-list p > span .va-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.staff-list p{margin:6px 0;display:flex;align-items:center;gap:8px;font-size:13px}
.staff-list p > strong{flex-shrink:0}
.staff-list p .staff-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.character-list img,.staff-list img{width:50px;height:50px;object-fit:cover;border-radius:5px;border:1px solid var(--border)}
.character-list p.list-empty,.staff-list p.list-empty{display:block;grid-template-columns:none;text-align:center;color:var(--text-muted);font-style:italic;font-size:13px;padding:8px 0}
.more-info-trigger{cursor:pointer;color:var(--primary);text-decoration:underline;display:inline-block;margin:10px 0;font-weight:700}
.more-info-trigger:hover{opacity:.85}
.more-info-loading{position:relative;width:100%;height:40px;background:transparent;display:flex;justify-content:center;align-items:center;z-index:10;opacity:1;transition:opacity .5s ease}
.more-info-loading.hidden{opacity:0;pointer-events:none;display:none}
.spinner{border:4px solid rgba(255,255,255,.12);border-top:4px solid var(--primary);border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.loading-dots::after{content:'';display:inline-block;width:20px;text-align:left;animation:dots 1.5s steps(5,end) infinite}
@keyframes dots{0%{content:''}20%{content:'.'}40%{content:'..'}60%{content:'...'}80%{content:'....'}100%{content:''}}
/* ---- Modal ---- */
.modal{display:none;position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,.75);align-items:center;justify-content:center}
.modal-content{position:relative;margin:0 auto;padding:0;width:80%;max-width:600px;background:#000;border-radius:8px}
.close-modal{position:absolute;top:10px;right:15px;color:#fff;font-size:24px;cursor:pointer;z-index:2500}
#modalVideo{width:100%;aspect-ratio:16/9;background:#000;border-radius:8px;display:none}
#modalIframe{width:100%;height:337px;border-radius:8px;display:none}
#modalImage{width:100%;max-height:80vh;object-fit:contain;border-radius:8px;display:none}
/* ---- Responsive ---- */
@media (max-width:600px){
.search-result-box{width:92%;max-width:400px}
#image-url{font-size:13px;padding:8px 12px}
button#search-anime-btn{padding:8px 12px;font-size:12px}
.preview-media img,.trailer-link img{height:80px;width:80px}
.anime-title{font-size:.88em}
#search-result-content{display:block}
#result-list{max-width:100%}
#detail-content{display:none;padding-left:5px;padding-right:5px;overflow-y:auto;max-height:calc(80vh - 50px)}
.summary-info{width:calc(100% - 100px)}
.poster-frame{width:80px}
.character-list p{grid-template-columns:50px 1fr 1fr}
.video-wrapper{max-width:100%}
.detail-preview img{max-width:100%}
}
@media (min-width:601px){
#search-result-content{display:flex}
#detail-content{display:none;min-height:100%}
.search-result-box{max-width:1100px}
#result-list{max-width:550px}
}
/* ---- Hormati preferensi pengguna yang sensitif terhadap gerakan ---- */
@media (prefers-reduced-motion:reduce){
*{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
.scene-mode-toggle:hover{transform:none}
.preview-media.clickable:hover img,.trailer-link.clickable:hover img,.detail-preview.clickable:hover img,.poster.clickable:hover,.character-list img.clickable:hover,.staff-list img.clickable:hover{transform:none}
button#search-anime-btn:hover{transform:none}
.loading-dots::after{animation:none;content:'...'}
}
