# Keeping it fair: the lines Beyond Music holds to

The full write-up, with the sections of the Copyright Act 1994 and what's still open, is a document for Kyle to run
past a lawyer: https://claude.ai/artifact/AVtqer8QskaokPVxBApmhq. This is the short version the code follows. It is
not legal advice.

| What the law allows (s 81A format shifting, and the household's own work) | How the code holds to it |
|---|---|
| A copy of a sound recording you own, for your own household | Plays only the household's folders; only answers the house network (`main.mjs`) |
| One copy per device | Streams from the box; it doesn't push copies to devices |
| Only while you still own the original | Copied CDs are filed as such; *I sold or gave away this CD* deletes our copies and hides any in your folders (`/api/albums/:id/sold`) |
| Not for films or TV (s 81A covers sound recordings) | Plays video files the household already has; never copies a disc |
| No breaking of copy protection (s 226A and on) | No DVD or Blu-ray ripping, no decryption tools, ever |
| No infringing sources | No torrents, indexers or downloads from sharing sites |
| Lyrics are their own copyright | Never stored or shown |
| A copy on a USB stick is still a copy for your own household | The stick takes only songs from the household's folders, only to a stick plugged into the box; the screen says playing out at a venue needs the venue's licence (OneMusic) |
| Only while you still own the original, on the stick too | *I sold or gave away this CD* takes the album off the box; the next copy to the stick takes it off there. A stick that has left the house can't be reached, and the screen doesn't pretend otherwise |
| Reading and writing another program's file format to work with it | The stick's library format was worked out from public descriptions (Crate Digger), for interoperability; nothing of Pioneer's is copied or unlocked |
| Radio stations' own streams | Played live from the station's own site; never recorded |

Privacy: what anybody plays stays on the box (*Played recently*), never sent to Beyond or anyone else.
