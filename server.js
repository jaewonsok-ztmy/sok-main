require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");


// ======================================================
// Supabase 설정
// ======================================================

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;


if (!SUPABASE_URL || !SUPABASE_KEY) {

    console.log("❌ Supabase 환경변수를 확인하세요.");
    process.exit();

}


const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ======================================================
// ★★★ 가수 추가하는 곳 ★★★
//
// 앞으로 새로운 가수를 추가할 때
// 여기만 추가하면 됨.
//
// name          = 사이트에 표시할 가수 이름
// mbid          = MusicBrainz Artist ID
// fallbackGenre = MusicBrainz에 장르 정보가 없을 때 사용할 장르
// ======================================================

const ARTISTS = [

    {
        name: "ずっと真夜中でいいのに。",
        mbid: "14d2a235-30e2-489f-b490-f9dc7d2c0861",
        fallbackGenre: "J-Pop"
    },
    {
        name: "Radiohead",
        mbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
        fallbackGenre: "Alternative Rock"
    },

    {
        name: "Muse",
        mbid: "9c9f1380-2516-4fc9-a3e6-f9f61941d090",
        fallbackGenre: "Alternative Rock"
    }



    // ==============================================
    // 새 가수 추가 예시
    // ==============================================

    /*
    ,
    {
        name: "Radiohead",
        mbid: "여기에_Radiohead_MusicBrainz_ID",
        fallbackGenre: "Alternative Rock"
    }
    */

];


// ======================================================
// 대기
// ======================================================

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


// ======================================================
// MusicBrainz API
//
// 429 / 502 / 503 자동 재시도
// ======================================================

async function musicBrainzFetch(url) {

    const maxRetries = 5;


    for (
        let attempt = 1;
        attempt <= maxRetries;
        attempt++
    ) {

        try {

            const response = await fetch(
                url,
                {
                    headers: {

                        "User-Agent":
                            "MusicPortfolio/1.0 (personal music website)",

                        "Accept":
                            "application/json"

                    }
                }
            );


            if (response.ok) {

                const data =
                    await response.json();


                // MusicBrainz 요청 제한 보호
                await sleep(1100);


                return data;

            }


            const status =
                response.status;


            console.log(
                `⚠ MusicBrainz 오류 : ${status}`
            );


            if (
                status === 429 ||
                status === 502 ||
                status === 503
            ) {

                if (attempt < maxRetries) {

                    const waitTime =
                        attempt * 5000;


                    console.log(
                        `${waitTime / 1000}초 후 재시도...`
                    );


                    await sleep(
                        waitTime
                    );


                    continue;

                }

            }


            const text =
                await response.text();


            console.log(text);


            throw new Error(
                `MusicBrainz 오류 ${status}`
            );

        }

        catch (error) {

            if (attempt < maxRetries) {

                const waitTime =
                    attempt * 5000;


                console.log(
                    `⚠ 요청 실패 - ${waitTime / 1000}초 후 재시도`
                );


                await sleep(
                    waitTime
                );


                continue;

            }


            throw error;

        }

    }


    throw new Error(
        "MusicBrainz 요청 실패"
    );

}


// ======================================================
// 아티스트 발매 목록
// Album / Single / EP
// ======================================================

async function getReleaseGroups(
    artistMbid
) {

    let offset = 0;

    const limit = 100;

    let groups = [];


    while (true) {

        const url =

            "https://musicbrainz.org/ws/2/release-group" +

            `?artist=${artistMbid}` +

            "&type=album|single|ep" +

            "&release-group-status=website-default" +

            "&fmt=json" +

            `&limit=${limit}` +

            `&offset=${offset}`;


        const result =
            await musicBrainzFetch(
                url
            );


        const current =
            result["release-groups"] || [];


        groups.push(
            ...current
        );


        if (
            current.length < limit
        ) {

            break;

        }


        offset +=
            current.length;

    }


    return groups;

}


// ======================================================
// Release Group 상세
// 장르 / 태그
// ======================================================

async function getReleaseGroupDetail(
    groupId
) {

    const url =

        `https://musicbrainz.org/ws/2/release-group/${groupId}` +

        "?inc=genres+tags" +

        "&fmt=json";


    return await musicBrainzFetch(
        url
    );

}


// ======================================================
// 공식 Release 가져오기
// ======================================================

async function getOfficialReleases(
    groupId
) {

    const url =

        "https://musicbrainz.org/ws/2/release" +

        `?release-group=${groupId}` +

        "&status=official" +

        "&fmt=json" +

        "&limit=100";


    const result =
        await musicBrainzFetch(
            url
        );


    return (
        result.releases || []
    );

}


// ======================================================
// 가장 오래된 공식 Release 선택
// ======================================================

function selectBestRelease(
    releases
) {

    if (
        releases.length === 0
    ) {

        return null;

    }


    const sorted =
        [...releases].sort(

            (a, b) => {

                const dateA =
                    a.date ||
                    "9999-99-99";


                const dateB =
                    b.date ||
                    "9999-99-99";


                return dateA.localeCompare(
                    dateB
                );

            }

        );


    return sorted[0];

}


// ======================================================
// Release 안의 트랙
// ======================================================

async function getTracks(
    releaseId
) {

    const url =

        `https://musicbrainz.org/ws/2/release/${releaseId}` +

        "?inc=recordings+artist-credits" +

        "&fmt=json";


    const release =
        await musicBrainzFetch(
            url
        );


    const tracks = [];


    for (
        const medium
        of release.media || []
    ) {

        for (
            const track
            of medium.tracks || []
        ) {

            if (
                !track.recording
            ) {

                continue;

            }


            tracks.push({

                title:
                    track.recording.title,

                musicbrainz_id:
                    track.recording.id

            });

        }

    }


    return tracks;

}


// ======================================================
// 제외할 버전
// ======================================================

function shouldExclude(
    title
) {

    const text =
        title
            .toLowerCase()
            .trim();


    const excludedWords = [

        "live",
        "remix",
        "instrumental",
        "karaoke",
        "off vocal",
        "8-bit",
        "8bit",
        "demo",
        "acoustic ver",
        "acoustic version",
        "radio edit"

    ];


    return excludedWords.some(

        word =>
            text.includes(word)

    );

}


// ======================================================
// 제목 정규화
// ======================================================

function normalizeTitle(
    title
) {

    return title

        .toLowerCase()

        .trim()

        .replace(
            /\s+/g,
            ""
        )

        .replace(
            /[・･]/g,
            ""
        )

        .replace(
            /[\(\)（）\[\]【】]/g,
            ""
        );

}


// ======================================================
// 같은 제목 중복 제거
//
// 한 아티스트 안에서 적용
// ======================================================

function removeDuplicates(
    songs
) {

    const map =
        new Map();


    for (
        const song
        of songs
    ) {

        const key =
            normalizeTitle(
                song.title
            );


        if (
            !map.has(key)
        ) {

            map.set(
                key,
                song
            );

        }

    }


    return [
        ...map.values()
    ];

}


// ======================================================
// Cover Art Archive
// ======================================================

async function getCoverUrl(
    releaseGroupId
) {

    const url =

        `https://coverartarchive.org/release-group/${releaseGroupId}/front-500`;


    try {

        const response =
            await fetch(
                url,
                {
                    method: "HEAD",
                    redirect: "follow"
                }
            );


        if (
            response.ok
        ) {

            return url;

        }

    }

    catch (error) {

        // 커버가 없어도
        // 전체 작업은 계속

    }


    return null;

}


// ======================================================
// MusicBrainz 장르/태그 → 사이트 하위장르 자동 분류
// ======================================================

function normalizeGenreTag(value) {

    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[_–—]/g, "-")
        .replace(/\s+/g, " ");

}


function mapGenres(
    detail,
    fallbackGenre
) {

    const found =
        new Set();

    const values = [];


    // MusicBrainz 공식 genre
    for (
        const genre
        of detail.genres || []
    ) {

        if (genre?.name) {

            values.push(
                normalizeGenreTag(
                    genre.name
                )
            );

        }

    }


    // MusicBrainz tags
    // count가 큰 태그부터 사용
    const sortedTags =
        [...(detail.tags || [])]
            .filter(
                tag =>
                    tag?.name &&
                    (tag.count ?? 0) > 0
            )
            .sort(
                (a, b) =>
                    (b.count ?? 0) -
                    (a.count ?? 0)
            )
            .slice(
                0,
                20
            );


    for (
        const tag
        of sortedTags
    ) {

        values.push(
            normalizeGenreTag(
                tag.name
            )
        );

    }


    for (
        const value
        of values
    ) {


        // ==============================================
        // ROCK
        // ==============================================

        if (
            value.includes("alternative rock") ||
            value === "alt rock" ||
            value.includes("grunge")
        ) {

            found.add(
                "Alternative Rock"
            );

        }


        if (
            value.includes("indie rock") ||
            value.includes("garage rock")
        ) {

            found.add(
                "Indie Rock"
            );

        }


        if (
            value.includes("hard rock")
        ) {

            found.add(
                "Hard Rock"
            );

        }


        if (
            value.includes("punk rock") ||
            value === "punk" ||
            value.includes("post-punk")
        ) {

            found.add(
                "Punk Rock"
            );

        }


        if (
            value.includes("progressive rock") ||
            value.includes("prog rock")
        ) {

            found.add(
                "Progressive Rock"
            );

        }


        if (
            value.includes("experimental rock") ||
            value.includes("math rock") ||
            value.includes("post-rock") ||
            value.includes("shoegaze") ||
            value.includes("psychedelic rock")
        ) {

            found.add(
                "Experimental Rock"
            );

        }


        // ==============================================
        // METAL
        // ==============================================

        if (
            value === "heavy metal" ||
            value === "metal"
        ) {

            found.add(
                "Heavy Metal"
            );

        }


        if (
            value.includes("alternative metal")
        ) {

            found.add(
                "Alternative Metal"
            );

        }


        if (
            value.includes("nu metal")
        ) {

            found.add(
                "Nu Metal"
            );

        }


        if (
            value.includes("metalcore")
        ) {

            found.add(
                "Metalcore"
            );

        }


        if (
            value.includes("thrash metal")
        ) {

            found.add(
                "Thrash Metal"
            );

        }


        if (
            value.includes("death metal") ||
            value.includes("black metal") ||
            value.includes("doom metal") ||
            value.includes("extreme metal")
        ) {

            found.add(
                "Extreme Metal"
            );

        }


        // ==============================================
        // POP
        // ==============================================

        if (
            value === "pop" ||
            value === "pop music" ||
            value.includes("dance pop")
        ) {

            found.add(
                "Mainstream Pop"
            );

        }


        if (
            value.includes("j-pop") ||
            value === "jpop" ||
            value.includes("japanese pop")
        ) {

            found.add(
                "J-Pop"
            );

        }


        if (
            value.includes("k-pop") ||
            value === "kpop" ||
            value.includes("korean pop")
        ) {

            found.add(
                "K-Pop"
            );

        }


        if (
            value.includes("indie pop")
        ) {

            found.add(
                "Indie Pop"
            );

        }


        if (
            value.includes("synth-pop") ||
            value.includes("synthpop") ||
            value.includes("electropop")
        ) {

            found.add(
                "Synth-Pop"
            );

        }


        if (
            value.includes("dream pop")
        ) {

            found.add(
                "Dream Pop"
            );

        }


        // ==============================================
        // JAZZ
        // ==============================================

        if (
            value.includes("traditional jazz") ||
            value.includes("dixieland") ||
            value === "swing"
        ) {

            found.add(
                "Traditional Jazz"
            );

        }


        if (
            value === "jazz" ||
            value.includes("bebop") ||
            value.includes("hard bop") ||
            value.includes("cool jazz") ||
            value.includes("free jazz")
        ) {

            found.add(
                "Modern Jazz"
            );

        }


        if (
            value.includes("jazz fusion") ||
            value === "fusion"
        ) {

            found.add(
                "Jazz Fusion"
            );

        }


        if (
            value.includes("acid jazz")
        ) {

            found.add(
                "Acid Jazz"
            );

        }


        if (
            value.includes("jazz funk") ||
            value.includes("jazz-funk")
        ) {

            found.add(
                "Jazz-Funk"
            );

        }


        // ==============================================
        // HIP-HOP / RAP
        // ==============================================

        if (
            value === "hip-hop" ||
            value === "hip hop" ||
            value === "rap"
        ) {

            found.add(
                "Hip-Hop"
            );

        }


        if (
            value === "trap" ||
            value.includes("trap music")
        ) {

            found.add(
                "Trap"
            );

        }


        if (
            value.includes("alternative hip-hop") ||
            value.includes("alternative hip hop")
        ) {

            found.add(
                "Alternative Hip-Hop"
            );

        }


        if (
            value.includes("boom bap")
        ) {

            found.add(
                "Boom Bap"
            );

        }


        if (
            value.includes("rap rock")
        ) {

            found.add(
                "Rap Rock"
            );

        }


        // ==============================================
        // R&B / SOUL
        // ==============================================

        if (
            value === "r&b" ||
            value === "rnb" ||
            value.includes("rhythm and blues")
        ) {

            found.add(
                "R&B"
            );

        }


        if (
            value.includes("alternative r&b") ||
            value.includes("alternative rnb")
        ) {

            found.add(
                "Alternative R&B"
            );

        }


        if (
            value === "soul"
        ) {

            found.add(
                "Soul"
            );

        }


        if (
            value.includes("neo soul") ||
            value.includes("neo-soul")
        ) {

            found.add(
                "Neo Soul"
            );

        }


        if (
            value === "funk" ||
            value.includes("funk music")
        ) {

            found.add(
                "Funk"
            );

        }


        // ==============================================
        // ELECTRONIC
        // ==============================================

        if (
            value === "house" ||
            value.includes("deep house") ||
            value.includes("tech house")
        ) {

            found.add(
                "House"
            );

        }


        if (
            value === "techno" ||
            value.includes("techno")
        ) {

            found.add(
                "Techno"
            );

        }


        if (
            value === "ambient" ||
            value.includes("ambient")
        ) {

            found.add(
                "Ambient"
            );

        }


        if (
            value.includes("drum and bass") ||
            value.includes("drum & bass") ||
            value === "dnb"
        ) {

            found.add(
                "Drum & Bass"
            );

        }


        if (
            value === "electronica" ||
            value === "electronic" ||
            value === "electronic music"
        ) {

            found.add(
                "Electronica"
            );

        }


        if (
            value === "idm" ||
            value.includes("intelligent dance music") ||
            value.includes("breakbeat")
        ) {

            found.add(
                "IDM / Experimental"
            );

        }


        // ==============================================
        // FOLK / ACOUSTIC
        // ==============================================

        if (
            value === "folk"
        ) {

            found.add(
                "Folk"
            );

        }


        if (
            value.includes("indie folk")
        ) {

            found.add(
                "Indie Folk"
            );

        }


        if (
            value === "acoustic"
        ) {

            found.add(
                "Acoustic"
            );

        }


        if (
            value.includes("folk rock")
        ) {

            found.add(
                "Folk Rock"
            );

        }


        if (
            value.includes("singer-songwriter") ||
            value.includes("singer songwriter")
        ) {

            found.add(
                "Singer-Songwriter"
            );

        }


        // ==============================================
        // EXPERIMENTAL
        // ==============================================

        if (
            value.includes("art pop")
        ) {

            found.add(
                "Art Pop"
            );

        }


        if (
            value.includes("art rock")
        ) {

            found.add(
                "Art Rock"
            );

        }


        if (
            value === "noise" ||
            value.includes("noise music")
        ) {

            found.add(
                "Noise"
            );

        }


        if (
            value.includes("avant-garde") ||
            value.includes("avant garde") ||
            value === "experimental"
        ) {

            found.add(
                "Avant-Garde"
            );

        }


        if (
            value.includes("experimental electronic")
        ) {

            found.add(
                "Experimental Electronic"
            );

        }

    }


    // MusicBrainz에 쓸 만한 세부 장르 정보가 없으면
    // 아티스트별 기본 하위장르 사용
    if (
        found.size === 0
    ) {

        found.add(
            fallbackGenre ||
            "Mainstream Pop"
        );

    }


    return [
        ...found
    ];

}


// ======================================================
// Supabase 장르 번호 가져오기
// ======================================================

async function loadGenreMap() {

    const {
        data,
        error
    } = await supabase

        .from("genre")

        .select(
            "genre_id, genre_name"
        );


    if (error) {

        throw new Error(
            error.message
        );

    }


    const map =
        new Map();


    for (
        const genre
        of data
    ) {

        map.set(
            genre.genre_name,
            genre.genre_id
        );

    }


    return map;

}


// ======================================================
// music 테이블 저장
// ======================================================

async function saveSong(
    song
) {

    const {
        data,
        error
    } = await supabase

        .from("music")

        .insert({

            title:
                song.title,

            artist:
                song.artist,

            album:
                song.album,

            release_date:
                song.release_date,

            cover_url:
                song.cover_url,

            musicbrainz_id:
                song.musicbrainz_id

        })

        .select(
            "music_id"
        )

        .single();


    if (error) {


        // 이미 존재하는 MusicBrainz Recording
        if (
            error.code === "23505"
        ) {

            const {
                data: existing
            } = await supabase

                .from("music")

                .select(
                    "music_id"
                )

                .eq(
                    "musicbrainz_id",
                    song.musicbrainz_id
                )

                .maybeSingle();


            return (
                existing?.music_id ||
                null
            );

        }


        console.log(
            `❌ 저장 실패 : ${song.artist} - ${song.title}`
        );

        console.log(
            error.message
        );


        return null;

    }


    console.log(
        `✅ 추가 : ${song.artist} - ${song.title}`
    );


    return data.music_id;

}


// ======================================================
// music_genre 연결
// ======================================================

async function connectGenres(
    musicId,
    genres,
    genreMap
) {

    for (
        const genreName
        of genres
    ) {

        const genreId =
            genreMap.get(
                genreName
            );


        if (
            !genreId
        ) {

            console.log(
                `⚠ 존재하지 않는 장르 : ${genreName}`
            );

            continue;

        }


        const {
            error
        } = await supabase

            .from(
                "music_genre"
            )

            .upsert({

                music_id:
                    musicId,

                genre_id:
                    genreId

            });


        if (error) {

            console.log(
                `❌ 장르 연결 실패 : ${genreName}`
            );

        }

    }

}



// ======================================================
// 처리한 Release Group 이력
// ======================================================

async function loadProcessedReleaseGroups(
    artistMbid
) {

    const {
        data,
        error
    } = await supabase

        .from(
            "processed_release_group"
        )

        .select(
            "release_group_id"
        )

        .eq(
            "artist_mbid",
            artistMbid
        );


    if (error) {

        throw new Error(
            `처리 이력 조회 실패 : ${error.message}`
        );

    }


    return new Set(
        (data || []).map(
            row =>
                row.release_group_id
        )
    );

}


async function hasExistingSongsForArtist(
    artistName
) {

    const {
        data,
        error
    } = await supabase

        .from(
            "music"
        )

        .select(
            "music_id"
        )

        .eq(
            "artist",
            artistName
        )

        .limit(1);


    if (error) {

        throw new Error(
            `기존 곡 확인 실패 : ${error.message}`
        );

    }


    return (
        data &&
        data.length > 0
    );

}


async function markReleaseGroupProcessed(
    group,
    artist
) {

    const {
        error
    } = await supabase

        .from(
            "processed_release_group"
        )

        .upsert(
            {
                release_group_id:
                    group.id,

                artist_mbid:
                    artist.mbid,

                artist_name:
                    artist.name,

                release_title:
                    group.title || null,

                first_release_date:
                    group[
                        "first-release-date"
                    ] || null,

                processed_at:
                    new Date().toISOString()
            },
            {
                onConflict:
                    "release_group_id"
            }
        );


    if (error) {

        throw new Error(
            `처리 이력 저장 실패 : ${error.message}`
        );

    }

}


// 기존 DB에 이미 곡이 있는데 처리 이력 테이블만 비어 있는 경우
// 현재 Release Group 목록을 "이미 처리됨"으로 빠르게 초기 등록한다.
async function bootstrapProcessedGroupsIfNeeded(
    artist,
    groups,
    processedIds
) {

    if (
        processedIds.size > 0
    ) {

        return false;

    }


    const hasSongs =
        await hasExistingSongsForArtist(
            artist.name
        );


    if (
        !hasSongs
    ) {

        return false;

    }


    console.log(
        `⚡ ${artist.name} : 기존 곡이 있어 처리 이력을 초기 등록합니다.`
    );


    const rows =
        groups.map(
            group => ({

                release_group_id:
                    group.id,

                artist_mbid:
                    artist.mbid,

                artist_name:
                    artist.name,

                release_title:
                    group.title || null,

                first_release_date:
                    group[
                        "first-release-date"
                    ] || null,

                processed_at:
                    new Date().toISOString()

            })
        );


    // Supabase 요청 크기를 줄이기 위해 100개씩 저장
    for (
        let i = 0;
        i < rows.length;
        i += 100
    ) {

        const chunk =
            rows.slice(
                i,
                i + 100
            );


        const {
            error
        } = await supabase

            .from(
                "processed_release_group"
            )

            .upsert(
                chunk,
                {
                    onConflict:
                        "release_group_id"
                }
            );


        if (error) {

            throw new Error(
                `초기 처리 이력 저장 실패 : ${error.message}`
            );

        }

    }


    console.log(
        `✅ ${groups.length}개 Release Group을 기존 처리 이력으로 등록`
    );


    return true;

}


// ======================================================
// 한 아티스트 처리
// ======================================================

async function processArtist(
    artist,
    genreMap
) {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        `🎤 ${artist.name}`
    );

    console.log(
        "========================================"
    );


    // 발매 목록 자체는 매번 확인한다.
    // 이 조회는 상세/트랙 조회보다 훨씬 가볍다.
    const groups =
        await getReleaseGroups(
            artist.mbid
        );


    console.log(
        `${groups.length}개 발매 발견`
    );


    const processedIds =
        await loadProcessedReleaseGroups(
            artist.mbid
        );


    // 최적화 버전을 처음 쓰는 경우:
    // 이미 DB에 이 아티스트 곡이 있다면 현재 발매들을
    // 처리 완료 상태로 한 번에 초기 등록한다.
    const bootstrapped =
        await bootstrapProcessedGroupsIfNeeded(
            artist,
            groups,
            processedIds
        );


    if (
        bootstrapped
    ) {

        console.log(
            `⏭ ${artist.name} : 초기 이력 등록 완료, 상세 재검사 생략`
        );

        return;

    }


    const newGroups =
        groups.filter(
            group =>
                !processedIds.has(
                    group.id
                )
        );


    console.log(
        `🆕 새로 확인할 발매 : ${newGroups.length}개`
    );


    if (
        newGroups.length === 0
    ) {

        console.log(
            `✅ ${artist.name} : 새로운 발매 없음`
        );

        return;

    }


    for (
        const group
        of newGroups
    ) {

        console.log("");
        console.log(
            `📀 새 발매 검사 : ${group.title}`
        );


        try {

            // 장르 정보
            const detail =
                await getReleaseGroupDetail(
                    group.id
                );


            const genres =
                mapGenres(
                    detail,
                    artist.fallbackGenre
                );


            // 공식 Release
            const releases =
                await getOfficialReleases(
                    group.id
                );


            const release =
                selectBestRelease(
                    releases
                );


            if (
                !release
            ) {

                console.log(
                    "⚠ 공식 Release 없음 - 다음 실행에서 다시 확인"
                );

                // 나중에 공식 Release가 생길 수도 있으므로
                // processed에는 넣지 않는다.
                continue;

            }


            // 곡
            let tracks =
                await getTracks(
                    release.id
                );


            tracks =
                tracks.filter(
                    track =>
                        !shouldExclude(
                            track.title
                        )
                );


            // 같은 새 발매 안에서 제목 중복 제거
            const songs =
                removeDuplicates(
                    tracks.map(
                        track => ({

                            title:
                                track.title,

                            artist:
                                artist.name,

                            musicbrainz_id:
                                track.musicbrainz_id,

                            album:
                                group.title,

                            release_date:

                                group[
                                    "first-release-date"
                                ] ||

                                release.date ||

                                null,

                            cover_url:
                                null,

                            genres:
                                genres

                        })
                    )
                );


            // 커버는 실제 저장할 곡이 있을 때만 확인
            let coverUrl = null;

            if (
                songs.length > 0
            ) {

                coverUrl =
                    await getCoverUrl(
                        group.id
                    );

            }


            let failed = false;


            for (
                const song
                of songs
            ) {

                song.cover_url =
                    coverUrl;


                const musicId =
                    await saveSong(
                        song
                    );


                if (
                    !musicId
                ) {

                    failed = true;
                    continue;

                }


                await connectGenres(

                    musicId,

                    song.genres,

                    genreMap

                );

            }


            // 저장 실패가 하나라도 있으면 다음 실행에서 다시 검사
            if (
                failed
            ) {

                console.log(
                    `⚠ ${group.title} : 일부 저장 실패 - 처리 완료로 표시하지 않음`
                );

                continue;

            }


            await markReleaseGroupProcessed(
                group,
                artist
            );


            console.log(
                `✅ 처리 완료 : ${group.title}`
            );

        }

        catch (error) {

            console.log(
                `❌ 발매 처리 실패 : ${group.title}`
            );

            console.log(
                error.message
            );

            console.log(
                "다음 실행에서 다시 시도합니다."
            );

        }

    }

}


// ======================================================
// 전체 실행
// ======================================================

async function main() {

    try {

        console.log(
            "Supabase 연결 확인 중..."
        );


        const {
            error
        } = await supabase

            .from("genre")

            .select(
                "genre_id"
            )

            .limit(1);


        if (error) {

            throw new Error(
                error.message
            );

        }


        console.log(
            "✅ Supabase 연결 성공"
        );


        const genreMap =
            await loadGenreMap();


        // ==============================================
        // 등록된 아티스트 순서대로 처리
        // ==============================================

        for (
            const artist
            of ARTISTS
        ) {

            await processArtist(
                artist,
                genreMap
            );

        }


        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "✅ 모든 아티스트 업데이트 완료"
        );

        console.log(
            "========================================"
        );

    }

    catch (error) {

        console.log("");
        console.log(
            "❌ 오류 발생"
        );

        console.log(
            error.message
        );

    }

}


main();