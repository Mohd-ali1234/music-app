import json
from pathlib import Path
from yt_dlp import YoutubeDL


def extract_metadata(video_url: str):
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extract_flat": False,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)

    return info


def print_interesting_fields(info):
    fields = [
        "id",
        "title",
        "fulltitle",
        "track",
        "artist",
        "album",
        "album_artist",
        "creator",
        "uploader",
        "uploader_id",
        "channel",
        "channel_id",
        "duration",
        "release_year",
        "release_date",
        "upload_date",
        "language",
        "categories",
        "tags",
        "availability",
        "live_status",
        "view_count",
        "like_count",
        "comment_count",
        "channel_follower_count",
        "age_limit",
        "webpage_url",
        "thumbnail",
        "description",
    ]

    print("=" * 80)
    print("IMPORTANT METADATA")
    print("=" * 80)

    for field in fields:
        value = info.get(field)

        if isinstance(value, list):
            print(f"\n{field}:")
            if len(value) == 0:
                print("  []")
            else:
                for item in value:
                    print("  -", item)

        else:
            print(f"{field}: {value}")

    print("=" * 80)


def print_all_keys(info):
    print("\nALL AVAILABLE KEYS")
    print("=" * 80)

    keys = sorted(info.keys())

    for key in keys:
        print(key)

    print("=" * 80)
    print(f"Total Keys: {len(keys)}")


def save_json(info):
    output_dir = Path("metadata_output")
    output_dir.mkdir(exist_ok=True)

    filename = output_dir / f"{info['id']}.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(info, f, indent=4, ensure_ascii=False)

    print(f"\n✅ Full metadata saved to:\n{filename.absolute()}")


def main():
    print("YouTube Metadata Extractor")
    print()

    video = input(
        "Enter YouTube URL or Video ID:\n> "
    ).strip()

    if "youtube.com" not in video and "youtu.be" not in video:
        video = f"https://www.youtube.com/watch?v={video}"

    print("\nFetching metadata...\n")

    try:
        info = extract_metadata(video)

        print_interesting_fields(info)

        print_all_keys(info)

        save_json(info)

    except Exception as e:
        print("\n❌ Error")
        print(e)


if __name__ == "__main__":
    main()