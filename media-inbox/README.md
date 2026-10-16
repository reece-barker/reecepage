# Media inbox

Drop pictures and videos in here and run

    npm run media:import

Each file is added to the media library, then moved to `media-inbox/done/` so it isnt added twice.

Optional extras next to a file, with the same name:

- `photo.yml` with `title`, `alt` (needed for pictures), `caption`, `credit`, `publish: true`, `feature: true`
  (the video on the home page), `web: true` (re-encode for the web, needs ffmpeg) or `faststart: true`
- `video.srt` or `video.vtt` captions, they also become the transcript
- `video.jpg` / `video.png` / `video.webp` the poster

A `.yml` on its own with a `source:` line imports a file from somewhere else on your computer without copying it in,
see `intro-video.yml`. Without a yml the title is made from the file name and the item stays unpublished, finish it at
http://localhost:3000/admin/media
