// Prints the current media session as one JSON line per second.
// {"title","artist","album","durationMs","positionMs","playing","thumbnailBase64"?} or {"none":true}
// The thumbnail is only sent when the song changes.
using System.Text.Json;
using Windows.Media.Control;
using Windows.Storage.Streams;

var mgr = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
var stdout = Console.Out;
string lastKey = "";

while (true)
{
    try
    {
        var sessions = mgr.GetSessions();
        var s = sessions.FirstOrDefault(x => x.SourceAppUserModelId.Contains("Spotify", StringComparison.OrdinalIgnoreCase))
                ?? mgr.GetCurrentSession();
        if (s is null)
        {
            stdout.WriteLine("{\"none\":true}");
            lastKey = "";
        }
        else
        {
            var props = await s.TryGetMediaPropertiesAsync();
            var tl = s.GetTimelineProperties();
            var playing = s.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
            var pos = tl.Position;
            if (playing) pos += DateTimeOffset.Now - tl.LastUpdatedTime;
            var key = $"{props.Artist}|{props.Title}";
            string? thumb = null;
            if (key != lastKey && props.Thumbnail is not null)
            {
                using var stream = await props.Thumbnail.OpenReadAsync();
                var buf = new byte[stream.Size];
                using var reader = new DataReader(stream);
                await reader.LoadAsync((uint)stream.Size);
                reader.ReadBytes(buf);
                thumb = Convert.ToBase64String(buf);
            }
            lastKey = key;
            var o = new Dictionary<string, object?>
            {
                ["title"] = props.Title,
                ["artist"] = props.Artist,
                ["album"] = props.AlbumTitle,
                ["durationMs"] = (long)(tl.EndTime - tl.StartTime).TotalMilliseconds,
                ["positionMs"] = (long)Math.Max(0, pos.TotalMilliseconds),
                ["playing"] = playing,
            };
            if (thumb is not null) o["thumbnailBase64"] = thumb;
            stdout.WriteLine(JsonSerializer.Serialize(o));
        }
        stdout.Flush();
    }
    catch
    {
        stdout.WriteLine("{\"none\":true}");
        stdout.Flush();
    }
    await Task.Delay(1000);
}
