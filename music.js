/* =========================================================
   1. Supabase 설정
   ---------------------------------------------------------
   Project Settings -> API에서 아래 두 값을 넣어주세요.
   SERVICE_ROLE KEY는 절대 넣지 마세요.
========================================================= */
const SUPABASE_URL = "https://pxkyfjbepurciuuyclhk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lUk5CFcNer_sXxc6jd04CA_FpZmIfya";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================================================
   2. 상태
========================================================= */
let musicData = [];
let genreData = [];

const state = {
    level: "major", // major | sub | songs
    majorGenre: null,
    subGenre: null,
    selectedNode: null
};

const camera = {
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.45,
    maxScale: 2.2
};

const archive = document.getElementById("music-archive");
const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const detail = document.getElementById("music-detail");
const breadcrumb = document.getElementById("breadcrumb");

/* =========================================================
   3. parent_id가 없는 DB에서도 동작하게 하는 보조 분류
   ---------------------------------------------------------
   genre 테이블에 parent_id가 있으면 그 값을 우선 사용하고,
   없으면 아래 이름 기준으로 큰 장르를 판단합니다.
========================================================= */
const GENRE_GROUPS = {
    "Pop": ["pop", "j-pop", "indie pop", "synth-pop", "synthpop", "dream pop", "art pop"],
    "Rock": ["rock", "alternative rock", "indie rock", "hard rock", "punk rock", "rap rock", "math rock", "shoegaze", "art rock", "new wave", "britpop", "funk rock"],
    "Metal": ["metal", "nu metal", "heavy metal", "metalcore", "alternative metal"],
    "Hip-Hop / Rap": ["hip-hop / rap", "hip-hop", "hip hop", "rap", "trap", "alternative hip-hop", "alternative hip hop"],
    "Jazz": ["jazz", "jazz fusion", "acid jazz", "jazz funk"],
    "Electronic": ["electronic", "house", "techno", "ambient", "drum & bass", "drum and bass", "electronica"],
    "R&B / Soul": ["r&b / soul", "r&b", "rnb", "alternative r&b", "soul", "funk"],
    "Folk / Acoustic": ["folk / acoustic", "folk", "indie folk", "acoustic"],
    "Experimental": ["experimental", "art pop", "art rock", "noise"]
};

/* =========================================================
   4. Supabase에서 데이터 불러오기
========================================================= */
async function loadMusicFromSupabase() {
    showEmpty("LOADING", "Supabase에서 음악 데이터를 불러오는 중입니다.");

    try {
        const [musicResult, genreResult, linkResult] = await Promise.all([
            db.from("music")
                .select("*")
                .order("release_date", { ascending: false }),

            db.from("genre")
                .select("*")
                .order("genre_id", { ascending: true }),

            db.from("music_genre")
                .select("music_id, genre_id")
        ]);

        if (musicResult.error) throw musicResult.error;
        if (genreResult.error) throw genreResult.error;
        if (linkResult.error) throw linkResult.error;

        const musicRows = musicResult.data || [];
        const genreRows = genreResult.data || [];
        const links = linkResult.data || [];

        genreData = genreRows;

        const genreById = new Map(
            genreRows.map(genre => [Number(genre.genre_id), genre])
        );

        const genresByMusicId = new Map();

        links.forEach(link => {
            const musicId = Number(link.music_id);
            const genre = genreById.get(Number(link.genre_id));
            if (!genre) return;

            if (!genresByMusicId.has(musicId)) {
                genresByMusicId.set(musicId, []);
            }

            genresByMusicId.get(musicId).push(genre);
        });

        musicData = musicRows.map(row => ({
            id: Number(row.music_id),
            title: row.title || "Untitled",
            artist: row.artist || "Unknown Artist",
            album: row.album || "",
            releaseDate: row.release_date || "",
            year: row.release_date ? new Date(row.release_date).getFullYear() : "",
            cover: row.cover_url || "",
            musicbrainzId: row.musicbrainz_id || "",
            genreObjects: genresByMusicId.get(Number(row.music_id)) || []
        }));

        renderMajorGenres();
        updateBreadcrumb();
        resetCamera();

    } catch (error) {
        console.error("Supabase 데이터 로딩 오류:", error);
        showEmpty(
            "SUPABASE ERROR",
            "Supabase URL/키, RLS SELECT 정책, music / genre / music_genre 테이블을 확인해 주세요."
        );
    }
}

/* =========================================================
   5. 장르 계층 계산
========================================================= */
function normalizeGenre(value = "") {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[_–—]/g, "-")
        .replace(/\s+/g, " ");
}

function genreName(genre) {
    return genre?.genre_name || genre?.name || "";
}

function getGenreById(id) {
    return genreData.find(g => Number(g.genre_id) === Number(id));
}

function hasParentIdColumn() {
    return genreData.some(g => Object.prototype.hasOwnProperty.call(g, "parent_id"));
}

function getMajorNameFromGenre(genre) {
    if (!genre) return "Other";

    // parent_id가 실제 DB에 있으면 DB 계층을 그대로 사용
    if (hasParentIdColumn()) {
        const parentId = genre.parent_id;

        if (parentId === null || parentId === undefined || parentId === "") {
            return genreName(genre) || "Other";
        }

        const parent = getGenreById(parentId);
        return parent ? genreName(parent) : "Other";
    }

    // parent_id가 없으면 이름으로 큰 장르 판단
    const name = normalizeGenre(genreName(genre));

    for (const [major, names] of Object.entries(GENRE_GROUPS)) {
        if (names.some(item => normalizeGenre(item) === name)) {
            return major;
        }
    }

    return "Other";
}

function getMajorGenres() {
    const majors = new Set();

    musicData.forEach(song => {
        song.genreObjects.forEach(genre => {
            majors.add(getMajorNameFromGenre(genre));
        });
    });

    return [...majors].sort((a, b) => a.localeCompare(b));
}

function songBelongsToMajor(song, major) {
    return song.genreObjects.some(genre => getMajorNameFromGenre(genre) === major);
}

function getSongsForMajor(major) {
    return musicData.filter(song => songBelongsToMajor(song, major));
}

function getSubGenres(major) {
    const subs = new Set();

    getSongsForMajor(major).forEach(song => {
        const matching = song.genreObjects.filter(
            genre => getMajorNameFromGenre(genre) === major
        );

        matching.forEach(genre => {
            const name = genreName(genre);
            if (!name) return;

            // parent_id가 있을 경우: 부모 없는 항목은 큰 장르 자체이므로 제외
            if (hasParentIdColumn()) {
                const isMajor = genre.parent_id === null ||
                    genre.parent_id === undefined ||
                    genre.parent_id === "";

                if (!isMajor) subs.add(name);
                return;
            }

            // parent_id가 없을 경우: 큰 장르명 자체는 하위 장르에서 제외
            if (normalizeGenre(name) !== normalizeGenre(major)) {
                subs.add(name);
            }
        });
    });

    // 세부 장르가 하나도 없다면 큰 장르에만 연결된 곡을 보기 위한 항목
    if (subs.size === 0 && getSongsForMajor(major).length > 0) {
        subs.add(`Other ${major}`);
    }

    return [...subs].sort((a, b) => {
        const ao = a.startsWith("Other ");
        const bo = b.startsWith("Other ");
        if (ao !== bo) return ao ? 1 : -1;
        return a.localeCompare(b);
    });
}

function songMatchesSubGenre(song, major, subGenre) {
    if (!songBelongsToMajor(song, major)) return false;

    const matching = song.genreObjects.filter(
        genre => getMajorNameFromGenre(genre) === major
    );

    if (subGenre === `Other ${major}`) {
        if (hasParentIdColumn()) {
            return matching.every(genre =>
                genre.parent_id === null ||
                genre.parent_id === undefined ||
                genre.parent_id === ""
            );
        }

        return matching.every(genre =>
            normalizeGenre(genreName(genre)) === normalizeGenre(major)
        );
    }

    return matching.some(
        genre => normalizeGenre(genreName(genre)) === normalizeGenre(subGenre)
    );
}

/* =========================================================
   6. 화면 렌더링
========================================================= */
function clearWorld() {
    world.innerHTML = "";
    state.selectedNode = null;
    detail.style.display = "none";
}

function renderMajorGenres() {
    state.level = "major";
    state.majorGenre = null;
    state.subGenre = null;
    clearWorld();

    const genres = getMajorGenres();

    if (!genres.length) {
        showEmpty("NO MUSIC", "Supabase에 표시할 장르 데이터가 없습니다.");
        return;
    }

    const counts = Object.fromEntries(
        genres.map(genre => [genre, getSongsForMajor(genre).length])
    );

    renderGenreNodes(genres, "major", counts, major => {
        renderSubGenres(major);
    });

    updateBreadcrumb();
    resetCamera();
}

function renderSubGenres(major) {
    state.level = "sub";
    state.majorGenre = major;
    state.subGenre = null;
    clearWorld();

    const subs = getSubGenres(major);

    const counts = Object.fromEntries(
        subs.map(sub => [
            sub,
            musicData.filter(song => songMatchesSubGenre(song, major, sub)).length
        ])
    );

    if (!subs.length) {
        showEmpty(major, "이 큰 장르에 연결된 하위 장르가 없습니다.");
    } else {
        renderGenreNodes(subs, "sub", counts, sub => {
            renderSongs(major, sub);
        });
    }

    updateBreadcrumb();
    resetCamera();
}

function renderGenreNodes(genres, type, counts, onEnter) {
    const centerX = 1200;
    const centerY = 720;
    const radiusX = type === "major" ? 720 : 790;
    const radiusY = type === "major" ? 460 : 500;

    genres.forEach((genre, index) => {
        const angle = (Math.PI * 2 * index) / genres.length - Math.PI / 2;
        const wobble = 0.82 + ((index * 37) % 25) / 100;
        const x = centerX + Math.cos(angle) * radiusX * wobble;
        const y = centerY + Math.sin(angle) * radiusY * wobble;

        const node = document.createElement("div");
        node.className = `genre-node ${type}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.transform = "translate(-50%, -50%)";

        node.innerHTML = `
            <h2>${escapeHtml(genre)}</h2>
            <span>${counts[genre] || 0} TRACKS · DOUBLE CLICK</span>
        `;

        node.addEventListener("click", event => {
            event.stopPropagation();

            if (state.selectedNode && state.selectedNode !== node) {
                state.selectedNode.classList.remove("selected");
            }

            node.classList.toggle("selected");
            state.selectedNode = node.classList.contains("selected") ? node : null;
        });

        node.addEventListener("dblclick", event => {
            event.stopPropagation();
            onEnter(genre);
        });

        world.appendChild(node);
    });
}

function renderSongs(major, subGenre) {
    state.level = "songs";
    state.majorGenre = major;
    state.subGenre = subGenre;
    clearWorld();

    const songs = musicData.filter(
        song => songMatchesSubGenre(song, major, subGenre)
    );

    if (!songs.length) {
        showEmpty(subGenre, "이 장르에 등록된 곡이 없습니다.");
        updateBreadcrumb();
        resetCamera();
        return;
    }

    const byArtist = new Map();

    songs.forEach(song => {
        const artist = song.artist || "Unknown Artist";
        if (!byArtist.has(artist)) byArtist.set(artist, []);
        byArtist.get(artist).push(song);
    });

    const stage = document.createElement("section");
    stage.className = "song-stage";

    [...byArtist.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([artist, artistSongs]) => {
            const group = document.createElement("article");
            group.className = "artist-group";

            // 가수당 최대 10곡
            const visibleSongs = artistSongs
                .sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)))
                .slice(0, 10);

            group.innerHTML = `
                <h2 class="artist-name">${escapeHtml(artist)}</h2>
                <div class="song-list"></div>
            `;

            const list = group.querySelector(".song-list");

            visibleSongs.forEach(song => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "song-item";

                item.innerHTML = `
                    ${song.cover
                        ? `<img class="song-cover" src="${escapeAttribute(song.cover)}" alt="">`
                        : `<span class="song-cover"></span>`}
                    <span class="song-copy">
                        <span class="song-title">${escapeHtml(song.title)}</span>
                        <span class="song-meta">${escapeHtml(String(song.year || ""))}</span>
                    </span>
                `;

                item.addEventListener("click", event => {
                    event.stopPropagation();
                    showMusicDetail(song);
                });

                list.appendChild(item);
            });

            stage.appendChild(group);
        });

    world.appendChild(stage);
    updateBreadcrumb();
    resetCameraForSongs(byArtist.size);
}

function showEmpty(title, message) {
    clearWorld();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>`;
    world.appendChild(empty);
}

/* =========================================================
   7. Breadcrumb
========================================================= */
function updateBreadcrumb() {
    breadcrumb.innerHTML = "";

    addCrumb("MUSIC", () => renderMajorGenres(), state.level === "major");

    if (state.majorGenre) {
        addSeparator();
        addCrumb(
            state.majorGenre,
            () => renderSubGenres(state.majorGenre),
            state.level === "sub"
        );
    }

    if (state.subGenre) {
        addSeparator();
        addCrumb(
            state.subGenre,
            () => renderSongs(state.majorGenre, state.subGenre),
            true
        );
    }
}

function addCrumb(label, handler, current) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `crumb${current ? " current" : ""}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    breadcrumb.appendChild(button);
}

function addSeparator() {
    const separator = document.createElement("span");
    separator.className = "crumb-separator";
    separator.textContent = "/";
    breadcrumb.appendChild(separator);
}

document.getElementById("home-title").addEventListener("click", renderMajorGenres);

/* =========================================================
   8. 곡 상세정보
========================================================= */
function showMusicDetail(music) {
    const genres = music.genreObjects.map(genreName).filter(Boolean);

    detail.innerHTML = `
        <button class="detail-close" type="button" aria-label="닫기">×</button>
        ${music.cover
            ? `<img src="${escapeAttribute(music.cover)}" alt="${escapeAttribute(music.title)}">`
            : ""}
        <h2>${escapeHtml(music.title)}</h2>
        <p>ARTIST : ${escapeHtml(music.artist)}</p>
        <p>ALBUM : ${escapeHtml(music.album || "-")}</p>
        <p>YEAR : ${escapeHtml(String(music.year || "-"))}</p>
        <p>GENRE : ${escapeHtml(genres.join(" / ") || "-")}</p>
    `;

    detail.querySelector(".detail-close").addEventListener("click", () => {
        detail.style.display = "none";
    });

    detail.style.display = "block";
}

/* =========================================================
   9. 빈 공간 드래그 / 확대 축소
========================================================= */
let panning = false;
let panStartX = 0;
let panStartY = 0;
let cameraStartX = 0;
let cameraStartY = 0;

viewport.addEventListener("pointerdown", event => {
    if (event.target.closest(".genre-node, .song-item, #music-detail, .crumb")) return;

    panning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    cameraStartX = camera.x;
    cameraStartY = camera.y;
    archive.classList.add("dragging");
    viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", event => {
    if (!panning) return;

    camera.x = cameraStartX + (event.clientX - panStartX);
    camera.y = cameraStartY + (event.clientY - panStartY);
    applyCamera();
});

function endPan(event) {
    if (!panning) return;
    panning = false;
    archive.classList.remove("dragging");

    if (event && viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
    }
}

viewport.addEventListener("pointerup", endPan);
viewport.addEventListener("pointercancel", endPan);

viewport.addEventListener("wheel", event => {
    event.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const worldX = (mouseX - camera.x) / camera.scale;
    const worldY = (mouseY - camera.y) / camera.scale;

    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const nextScale = Math.min(
        camera.maxScale,
        Math.max(camera.minScale, camera.scale * factor)
    );

    camera.x = mouseX - worldX * nextScale;
    camera.y = mouseY - worldY * nextScale;
    camera.scale = nextScale;

    applyCamera();
}, { passive: false });

function resetCamera() {
    const viewWidth = viewport.clientWidth || window.innerWidth;
    const viewHeight = viewport.clientHeight || (window.innerHeight - 80);

    camera.scale = Math.min(0.78, Math.max(0.48, viewWidth / 2600));
    camera.x = (viewWidth - 2400 * camera.scale) / 2;
    camera.y = (viewHeight - 1500 * camera.scale) / 2;
    applyCamera();
}

function resetCameraForSongs(artistCount) {
    camera.scale = artistCount > 8 ? 0.62 : 0.78;
    camera.x = 15;
    camera.y = 5;
    applyCamera();
}

function applyCamera() {
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
}

window.addEventListener("resize", () => {
    if (state.level !== "songs") resetCamera();
});

/* =========================================================
   10. 문자열 안전 처리
========================================================= */
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

/* 시작 */
loadMusicFromSupabase();
