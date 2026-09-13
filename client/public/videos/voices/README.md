# Student films — the reel on Student Life

Four clips, one per student on `SlVoices`. Drop the files here with these
exact names and they play with no code change:

    aarav.mp4    Aarav Menon    Class 10 · Robotics    1:12
    kavya.mp4    Kavya Reddy    Class 9 · House captain 0:58
    zoya.mp4     Zoya Fatima    Class 7 · Library monitor 1:04
    rohan.mp4    Rohan Deshpande Class 10 · Athletics  1:21

The names, roles, quotes and runtimes are in `src/constants/campus-life.ts`
under `STUDENT_FILMS`. Change the runtime there if the delivered cut differs;
it is printed on the play button.

Shoot vertical or square. The panel that plays them letterboxes rather than
crops, so a landscape clip works but wastes the frame.

Captions: put a WebVTT file beside the clip (`aarav.vtt`) and set `captions`
on that entry. Leaving it unset renders no `<track>`, which is honest about
the film being uncaptioned rather than shipping an empty one.

Poster frames are separate, in `src/constants/imagery.ts` under `voiceImages`.
They are placeholders until a still is pulled from each film.
