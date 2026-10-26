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
| Radio stations' own streams | Played live from the station's own site; never recorded |

Privacy: what anybody plays stays on the box (*Played recently*), never sent to Beyond or anyone else.
