#!/usr/bin/env python3
"""既存5DBを Concentus の正規化スキーマへ移行する（1回限りの変換）。

データは GitHub の origin/main から直接取得する。ローカルのチェックアウトは
古い可能性があるため参照しない。

    python scripts/migrate.py                  # 取得して data/ へ出力
    python scripts/migrate.py --offline        # キャッシュのみで再実行
    python scripts/migrate.py --fetch-times    # started_at を YouTube API で実取得
                                               # （環境変数 YOUTUBE_API_KEY が必要）
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RAW = "https://raw.githubusercontent.com/Kinshutei/{repo}/main/{path}"

# --- 収録シンガー -------------------------------------------------------------
# channel_id は RKMusic_AllSinger_PFR/channels_config.json と
# natsuyo_no_kasenjiki/fetch_contents.py から取得した実値。
# url_path は公開URLのパス。旧DBのリポジトリ名をそのまま引き継ぐ
# （水瀬凪さんは旧DBが無いため暫定値）。
# color はユーザー指定の仮値。夜紺のみ既存DBのテーマカラー実値を使用
SINGERS = [
    {
        "singer_id": "mikage", "url_path": "Mikage_HishatainoHeya", "name": "深影", "name_en": "Mikage",
        "channel_id": "UC2daHxnuJJBM5NWci1RRkeA", "affiliation": "RK Music",
        "color": "#1e3a5f",  # ネイビー
        "repo": "Mikage_HishatainoHeya", "path": "streaminginfo_Mikage.json",
    },
    {
        "singer_id": "dia", "url_path": "dia_sing_for_answers", "name": "Diα", "name_en": "Dia",
        "channel_id": "UC80TduEq6Sp4n2DkiUH2eLQ", "affiliation": "RK Music",
        "color": "#c1272d",  # 紅
        "repo": "dia_sing_for_answers", "path": "streaminginfo_Dia.json",
    },
    {
        "singer_id": "wouca", "url_path": "unofficial_uwoter_no_oheya", "name": "wouca", "name_en": "wouca",
        "channel_id": "UC8TVZmQuOl0GNbpvThwwSdQ", "affiliation": "RK Music",
        "color": "#b8bec7",  # シルバー
        "repo": "unofficial_uwoter_no_oheya", "path": "streaminginfo_wouca.json",
    },
    {
        "singer_id": "kisaki", "url_path": "Imomushi_Hanemushi_Teams", "name": "妃玖", "name_en": "Kisaki",
        "channel_id": "UCFBc8kuCtTwmtdsBcJoZ3qA", "affiliation": "RK Music",
        "color": "#3a9d5c",  # 緑
        "repo": "Imomushi_Hanemushi_Teams", "path": "streaming_info.json",
    },
    {
        "singer_id": "nagi", "url_path": "minase_nagi", "name": "水瀬凪", "name_en": "Minase Nagi",
        "channel_id": "UCAplyWK80Y6_YTkb3CCDk1Q", "affiliation": "RK Music",
        "color": "#7ec8e3",  # 水色
        "repo": None, "path": None,  # 既存データ無し。これから登録する
    },
    {
        "singer_id": "yako", "url_path": "natsuyo_no_kasenjiki", "name": "夜紺火花", "name_en": "Yakon Hibana",
        "channel_id": "UCgKjo_iSJpFmXQypArDztYA", "affiliation": None,
        "color": "#16203a",  # 夜紺。natsuyo_no_kasenjiki のテーマカラー実値
        "repo": "natsuyo_no_kasenjiki", "path": "streaminginfo_Yako.json",
    },
]

# マスターは5リポジトリで完全一致するため、どれを取っても同じ
MASTER = ("natsuyo_no_kasenjiki", "rkmusic_song_master.json")

# 重複採番の未使用側5件と空行2件。歌唱データからの参照は無いので単純に落とす
DROP_SONG_IDS = {
    "S0972",  # 1/2        … S0492 と重複
    "S0839",  # ファンサ    … S0527 と重複
    "S0822",  # 新宝島      … S0089 と重複
    "S1202",  # 昼鳶        … S0831 と重複
    "S0950",  # 涙そうそう  … S0396 と重複
    "S0728",  # 空行
    "S1004",  # 空行
}

# 枠タイトルからの自動付与。誤検出の恐れが低いものだけを対象にする
TITLE_TAGS = [
    (("縦型",), "fmt_vertical"),
    (("耐久",), "ev_endurance"),
    (("リクエスト",), "ev_request"),
    (("記念", "周年"), "ev_anniversary"),
    (("ゲリラ",), "ev_guerrilla"),
    (("睡眠", "作業用"), "fmt_sleep"),
]

# 適用せず「候補」として報告するだけのもの。文脈判断が要るため
TITLE_TAG_HINTS = [
    (("コラボ",), "ev_collab"),
    (("ボカロ",), "lim_vocaloid"),
    (("昭和",), "lim_showa"),
    (("平成",), "lim_heisei"),
    (("アニソン",), "lim_anime"),
]

# 旧 補足情報 の値 → タグ。scope が frame のものは枠へ、performance のものは歌唱へ
NOTE_TAGS = {
    "#RKMusic歌枠リレー": ("frame", ["pj_rkmusic_relay"]),
    "#オリ曲で紡ぐ歌枠リレー": ("frame", ["pj_orikyoku_relay"]),
    "#魂の灯り歌枠リレー": ("frame", ["pj_tamashii_relay"]),
    "#四十華紅白歌枠リレー": ("frame", ["pj_shijuka_relay"]),
    "#愛をつなぐ歌枠リレー": ("frame", ["pj_aiwotsunagu_relay"]),
    "アカペラ": ("performance", ["arr_acappella"]),
    "ワンコーラス": ("performance", ["len_one"]),
    "独唱": ("performance", ["vo_solo"]),
    "即興ハモリ収録": ("performance", ["vo_harmony", "sp_impromptu"]),
    "途中で途切れハプあり": ("performance", ["sp_trouble"]),
}

VIDEO_ID = re.compile(r"(?:v=|live/|youtu\.be/|embed/)([A-Za-z0-9_-]{11})")
START_SEC = re.compile(r"[?&]t=(\d+)")


# --- 取得 ---------------------------------------------------------------------
def fetch(repo: str, path: str, cache: Path, offline: bool) -> list:
    dest = cache / f"{repo}__{path.replace('/', '_')}"
    if offline:
        if not dest.exists():
            sys.exit(f"キャッシュがありません: {dest}")
    else:
        url = RAW.format(repo=repo, path=urllib.parse.quote(path))
        with urllib.request.urlopen(url, timeout=60) as res:
            if res.status != 200:
                sys.exit(f"取得失敗 HTTP {res.status}: {url}")
            dest.write_bytes(res.read())
    return json.loads(dest.read_text(encoding="utf-8"))


# --- 変換ヘルパ ---------------------------------------------------------------
def norm_key(title: str, artist: str) -> str:
    """重複採番の検出キー。管理ツール側（JS）もこれと同じ規則を使うこと。

    区切りの \\x1f は除去処理の「後」に付ける。Python の \\s は \\x1c〜\\x1f を
    空白として扱うが JavaScript の \\s は扱わないため、先に連結すると両者で
    結果がずれる。
    """
    def clean(value: str) -> str:
        value = unicodedata.normalize("NFKC", str(value or "")).lower()
        return re.sub(r"[\s　・,、。!！?？'\"「」()（）~〜ー-]", "", value)

    return f"{clean(title)}\x1f{clean(artist)}"


def to_iso_date(value: str) -> str:
    """「2019年6月19日」「2019/6/19」等を YYYY-MM-DD にする。不明なら空。"""
    value = (value or "").strip()
    if not value:
        return ""
    jp = re.match(r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日", value)
    if jp:
        return f"{jp[1]}-{int(jp[2]):02d}-{int(jp[3]):02d}"
    sep = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", value)
    if sep:
        return f"{sep[1]}-{int(sep[2]):02d}-{int(sep[3]):02d}"
    return value


def pair(a: str, b: str) -> list[str]:
    return [v for v in ((a or "").strip(), (b or "").strip()) if v]


FORCE = False


def dump(path: Path, rows: list) -> None:
    """1行1レコードで書く。gitの差分が行単位で読めるようにするため。

    区切りを詰めるのは、管理ツール（JS）の JSON.stringify と1バイト単位で
    揃えるため。ずれると Push のたびに全行が差分として出る。

    このスクリプトは既存5DBからの初回投入用であり、出力を丸ごと上書きする。
    管理ツールで入力したデータを消さないよう、件数が減る書き込みは止める。
    """
    if path.exists() and not FORCE:
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            old = []
        if isinstance(old, list) and len(old) > len(rows):
            sys.exit(
                f"中止しました: {path}\n"
                f"  既存 {len(old)}件 → 生成 {len(rows)}件 で件数が減ります。\n"
                f"  管理ツールで入力したデータを失う可能性があります。\n"
                f"  意図した再生成であれば --force を付けてください。"
            )
    path.parent.mkdir(parents=True, exist_ok=True)
    body = ",\n".join(
        json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows
    )
    path.write_text(f"[\n{body}\n]\n", encoding="utf-8")


# --- started_at の実取得 ------------------------------------------------------
def fetch_started_at(video_ids: list[str], api_key: str) -> dict[str, dict]:
    """videos.list は1回1ユニット・ID50件まで。1,200枠でも24回で済む。"""
    found: dict[str, dict] = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        params = urllib.parse.urlencode({
            "part": "snippet,liveStreamingDetails,contentDetails",
            "id": ",".join(batch),
            "key": api_key,
        })
        with urllib.request.urlopen(
            f"https://www.googleapis.com/youtube/v3/videos?{params}", timeout=60
        ) as res:
            payload = json.loads(res.read())
        for item in payload.get("items", []):
            live = item.get("liveStreamingDetails", {})
            iso = live.get("actualStartTime") or item["snippet"]["publishedAt"]
            found[item["id"]] = {
                "started_at": iso,
                "duration_sec": parse_iso_duration(
                    item.get("contentDetails", {}).get("duration", "")
                ),
            }
        print(f"  YouTube API {min(i + 50, len(video_ids))}/{len(video_ids)}件")
    return found


def parse_iso_duration(value: str) -> int | None:
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value or "")
    if not m:
        return None
    h, mi, s = (int(g) if g else 0 for g in m.groups())
    return h * 3600 + mi * 60 + s


# --- 本体 ---------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="既存5DBを Concentus 形式へ移行する")
    ap.add_argument("--out", default=None, help="出力先（既定: <repo>/data）")
    ap.add_argument("--cache-dir", default=None, help="取得キャッシュの置き場")
    ap.add_argument("--offline", action="store_true", help="キャッシュのみ使う")
    ap.add_argument("--fetch-times", action="store_true",
                    help="started_at を YouTube API で実取得する")
    ap.add_argument("--force", action="store_true",
                    help="件数が減る上書きも実行する（入力済みデータを失う）")
    args = ap.parse_args()

    global FORCE
    FORCE = args.force

    root = Path(__file__).resolve().parent.parent
    out = Path(args.out) if args.out else root / "data"
    cache = Path(args.cache_dir) if args.cache_dir else root / ".cache"
    cache.mkdir(parents=True, exist_ok=True)

    report: list[str] = []

    def say(line: str = "") -> None:
        print(line)
        report.append(line)

    say("=== Concentus 移行 ===")
    say(f"取得元: GitHub origin/main{'（キャッシュ）' if args.offline else ''}")
    say()

    # ---- songs -----------------------------------------------------------
    master = fetch(*MASTER, cache=cache, offline=args.offline)
    songs, seen_keys = [], {}
    collisions = []
    for row in master:
        sid = row["song_id"]
        if sid in DROP_SONG_IDS:
            continue
        title = (row.get("楽曲名") or "").strip()
        artist = (row.get("原曲アーティスト") or "").strip()
        key = norm_key(title, artist)
        if title and key in seen_keys:
            collisions.append((seen_keys[key], sid, title, artist))
        elif title:
            seen_keys[key] = sid
        songs.append({
            "song_id": sid,
            "title": title,
            "artist": artist,
            "lyricists": pair(row.get("作詞1"), row.get("作詞2")),
            "composers": pair(row.get("作曲1"), row.get("作曲2")),
            "arrangers": pair(row.get("編曲1"), row.get("編曲2")),
            "released": to_iso_date(row.get("リリース日")),
            "song_tags": [],
            "norm_key": key,
        })
    dump(out / "songs.json", songs)
    say(f"songs.json      {len(master)}曲 → {len(songs)}曲（除外 {len(DROP_SONG_IDS)}件）")
    if collisions:
        say(f"  ⚠ 正規化キーの衝突が残っています: {collisions}")
    else:
        say("  正規化キーの衝突: なし")

    known_ids = {s["song_id"] for s in songs}

    # ---- frames / performances -------------------------------------------
    frames: list[dict] = []
    frame_tags: dict[str, set] = defaultdict(set)
    frame_hints: dict[str, set] = defaultdict(set)
    perf_by_singer: dict[str, list] = {}
    tag_counter: Counter = Counter()
    hint_counter: Counter = Counter()
    unknown_notes: Counter = Counter()
    dangling: list = []
    # 1つの video_id に複数の枠名/配信日がぶら下がっていたら、別々の配信が
    # 同じURLに紐づいている。放置すると2枠が1枠に合体して静かに壊れる。
    frame_identity: dict[str, set] = defaultdict(set)
    conflated: dict[str, set] = {}

    for singer in SINGERS:
        if not singer["repo"]:
            perf_by_singer[singer["singer_id"]] = []
            continue
        rows = fetch(singer["repo"], singer["path"], cache=cache, offline=args.offline)
        sid = singer["singer_id"]
        seen_frames: dict[str, dict] = {}
        perfs: list[dict] = []

        for row in rows:
            url = row.get("枠URL") or ""
            vm = VIDEO_ID.search(url)
            if not vm:
                say(f"  ⚠ video_id を取れない行を飛ばしました: {sid} {url!r}")
                continue
            vid = vm.group(1)
            fid = f"{sid}-{vid}"
            frame_identity[fid].add(
                ((row.get("枠名") or "").strip(), to_iso_date(row.get("配信日")))
            )
            if fid not in seen_frames:
                title = (row.get("枠名") or "").strip()
                seen_frames[fid] = {
                    "frame_id": fid,
                    "singer_id": sid,
                    "video_id": vid,
                    "title": title,
                    "started_at": "",
                    "day_order": 0,
                    "type": None,
                    "duration_sec": None,
                    "_date": to_iso_date(row.get("配信日")),
                }
                for words, tag in TITLE_TAGS:
                    if any(w in title for w in words):
                        frame_tags[fid].add(tag)
                        tag_counter[tag] += 1
                for words, tag in TITLE_TAG_HINTS:
                    if any(w in title for w in words):
                        frame_hints[fid].add(tag)
                        hint_counter[tag] += 1

            song_id = row.get("song_id")
            if song_id not in known_ids:
                dangling.append((sid, fid, song_id))

            sm = START_SEC.search(url)
            note = (row.get("補足情報") or "").strip()
            perf_tags: list[str] = []
            if note:
                scope, tags = NOTE_TAGS.get(note, (None, None))
                if scope == "frame":
                    frame_tags[fid].update(tags)
                    for t in tags:
                        tag_counter[t] += 1
                    note = ""
                elif scope == "performance":
                    perf_tags = list(tags)
                    for t in tags:
                        tag_counter[t] += 1
                    note = ""
                else:
                    unknown_notes[note] += 1

            perfs.append({
                "frame_id": fid,
                "song_id": song_id,
                "start_sec": int(sm.group(1)) if sm else 0,
                "tags": perf_tags,
                "collab": [],
                "note": note,
            })

        # start_sec 昇順が歌唱順そのものになる
        perfs.sort(key=lambda p: (p["frame_id"], p["start_sec"]))
        perf_by_singer[sid] = perfs
        frames.extend(seen_frames.values())

    # ---- started_at ------------------------------------------------------
    # 取得済みの実時刻は再実行で失わない。--fetch-times を付け忘れただけで
    # API取得した値が暫定値に戻ってしまうため。
    previous: dict[str, dict] = {}
    prev_path = out / "frames.json"
    if prev_path.exists():
        try:
            for f in json.loads(prev_path.read_text(encoding="utf-8")):
                at = f.get("started_at") or ""
                if at and not at.endswith("T00:00:00+09:00"):
                    previous[f["video_id"]] = f
        except (OSError, json.JSONDecodeError):
            pass

    provisional = 0
    if args.fetch_times:
        api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
        if not api_key:
            sys.exit("--fetch-times には環境変数 YOUTUBE_API_KEY が必要です")
        say()
        say("YouTube API から started_at を取得します")
        got = fetch_started_at([f["video_id"] for f in frames], api_key)
        for f in frames:
            hit = got.get(f["video_id"])
            if hit:
                f["started_at"] = hit["started_at"]
                f["duration_sec"] = hit["duration_sec"]
                if hit["duration_sec"] is not None:
                    # 歌枠アーカイブが対象なので Short 判定は行わない
                    f["type"] = "LiveArchive" if hit["duration_sec"] >= 360 else "Movie"
            else:
                f["started_at"] = f["_date"] + "T00:00:00+09:00" if f["_date"] else ""
                provisional += 1
    else:
        for f in frames:
            keep = previous.get(f["video_id"])
            if keep:
                f["started_at"] = keep["started_at"]
                f["duration_sec"] = keep.get("duration_sec")
                f["type"] = keep.get("type")
            else:
                f["started_at"] = f["_date"] + "T00:00:00+09:00" if f["_date"] else ""
                provisional += 1
        if previous:
            say(f"  既存の実時刻を {len(frames) - provisional}枠 で引き継ぎました")

    # 同日に複数ある枠は、実時刻が無いと順序が決まらない
    same_day: dict[tuple, list] = defaultdict(list)
    for f in frames:
        same_day[(f["singer_id"], f["_date"])].append(f)
    needs_day_order = [k for k, v in same_day.items() if len(v) > 1]

    for f in frames:
        f["tags"] = sorted(frame_tags.get(f["frame_id"], []))
        del f["_date"]
    frames.sort(key=lambda f: (f["started_at"], f["day_order"], f["frame_id"]))

    dump(out / "frames.json", frames)
    for sid, perfs in perf_by_singer.items():
        dump(out / "performances" / f"{sid}.json", perfs)

    # 雑談（FreeTalk）。既存5DBは曲しか持っていないので中身は空で作る。
    # TSGen が話題も抽出するため、以後は管理ツールから入力していく。
    for singer in SINGERS:
        path = out / "talks" / f"{singer['singer_id']}.json"
        if not path.exists():
            dump(path, [])

    singers_out = [
        {k: s[k] for k in
         ("singer_id", "url_path", "name", "name_en", "channel_id", "affiliation", "color")}
        | {"active": True}
        for s in SINGERS
    ]
    dump(out / "singers.json", singers_out)

    # ---- レポート ---------------------------------------------------------
    total_perf = sum(len(p) for p in perf_by_singer.values())
    say()
    say(f"singers.json    {len(singers_out)}名")
    say(f"frames.json     {len(frames)}枠")
    say(f"performances/   {total_perf}歌唱")
    for s in SINGERS:
        n = len(perf_by_singer[s["singer_id"]])
        mark = "  ← これから登録" if not s["repo"] else ""
        say(f"  {s['singer_id']:<7} {n:>5}行{mark}")

    say()
    say("自動付与したタグ")
    for tag, n in sorted(tag_counter.items(), key=lambda x: -x[1]):
        say(f"  {tag:<22} {n:>4}")

    conflated = {f: v for f, v in frame_identity.items() if len(v) > 1}
    say()
    if conflated:
        say("‼ 要修正: 1つの video_id に複数の配信がぶら下がっています")
        say("   どちらかの 枠URL に誤った video_id が入っています。")
        say("   このまま移行すると別々の配信が1枠に合体します。")
        for fid, variants in sorted(conflated.items()):
            say(f"   {fid}")
            for title, date in sorted(variants, key=lambda x: x[1]):
                n = sum(1 for p in perf_by_singer[fid.split("-", 1)[0]]
                        if p["frame_id"] == fid)
                say(f"     {date}  {title}")
            say(f"     → 合計 {n}歌唱が1枠に合体しています")
    else:
        say("video_id の重複: なし")

    say()
    say("要対応")
    say(f"  参照切れ song_id            {len(dangling)}件"
        + (f" {dangling[:5]}" if dangling else ""))
    say(f"  started_at が暫定値（0時）  {provisional}枠")
    say(f"  day_order の判断が要る日    {len(needs_day_order)}日")
    for key in sorted(needs_day_order):
        say(f"    {key[0]} {key[1]}: {len(same_day[key])}枠")
    if unknown_notes:
        say(f"  タグに変換できなかった補足情報 {sum(unknown_notes.values())}件")
        for note, n in unknown_notes.most_common():
            say(f"    {n:>3}回  {note!r}")
    else:
        say("  タグに変換できなかった補足情報 なし")

    say()
    say("タグ候補（文脈判断が要るため未適用）")
    for tag, n in sorted(hint_counter.items(), key=lambda x: -x[1]):
        ids = sorted(f for f, tags in frame_hints.items() if tag in tags)
        say(f"  {tag:<16} {n:>3}枠  {', '.join(ids[:4])}{' …' if len(ids) > 4 else ''}")

    report_path = out / "_migration_report.txt"
    report_path.write_text("\n".join(report) + "\n", encoding="utf-8")
    say()
    say(f"レポート: {report_path}")


if __name__ == "__main__":
    main()
