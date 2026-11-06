# Beyond UI standard

The fixes Kyle keeps having to make, turned into a checklist. Every app follows it. Master copy: beyond-agent-hq `docs/ui-standard.md` (change it there first, then copy). Last synced 06/11/2026.

ReUI is the only component library. If ReUI has no part for it, ask before using anything else. Apple platform apps also follow Apple's Human Interface Guidelines.

## Before you call a screen done

Look at it at 375px wide and at 1280px wide, in light and dark. Reading the code is a hypothesis, not a check. Measure the element you mean, not its wrapper.

## The checklist

1. **No sideways scroll.** `truncate` sets `nowrap`, so one long name pushes a card wider than the phone. Put `min-w-0` on the grid or flex item, not the truncating child. Keep `html, body { overflow-x: clip }` as the backstop.
2. **Nothing important lives behind hover.** Add `[@media(hover:none)]:opacity-100` (and `focus-visible`) to anything shown with `group-hover`. Delete, reorder, play and edit buttons are the usual victims.
3. **Tap targets are at least 44 by 44 points.** A small icon needs a 44px hit area. Leave 8px between neighbours.
4. **Fixed bars and floating buttons never cover content.** Pad the page for the tab bar plus the safe area.
5. **Safe areas.** `viewport-fit=cover`, pad fixed bars with `env(safe-area-inset-*)`, use `dvh` or `svh`, never bare `100vh`.
6. **Fixed means the visual viewport.** Use `overscroll-behavior-y: none` on the root where there is no pull to refresh.
7. **Inputs are 16px or more on phones**, or iOS zooms. Number and date inputs use the `en-NZ` locale and DD/MM/YYYY.
8. **Every theme token exists.** After installing a ReUI or shadcn part, check each class resolves in the built CSS.
9. **A pair of colours must differ enough.** Use a border or shadow, never colour alone, and meet 4.5:1 text contrast in light and dark.
10. **State is never colour alone.** Add an icon, a letter or a word. Use ReUI Badge light variants.
11. **Every page has a way out.** In an installed app there is no address bar, so give each page a back control to a declared parent.
12. **Empty states say what the thing is for and how to start**, with one primary action.
13. **Waiting never hangs.** Skeleton, then a clear error and a retry. Say nothing for the first 1.2 seconds.
14. **Dialogs, menus and popups stay on screen** at 375px, inside scroll areas and grids. Portalled popups pick up the theme.
15. **One primary action per view**, calm layout, generous space. Lists over 20 items need search or grouping. At most one entrance animation.
16. **Motion honours `prefers-reduced-motion`**, pauses off screen, animates only `transform` and `opacity`.
17. **Heavy parts load lazily.** Compare the main bundle before and after any new UI package.
18. **Touch and keyboard both work.** Visible focus ring, focus order follows reading order.
19. **Copy.** New Zealand English, no em dashes, DD/MM/YYYY dates, Beyond™ in customer-facing text, no invented numbers.
20. **Email layout.** Table layout, 600px max, inline styles, a plain text part, dark mode tested, unsubscribe and sender details present.

### Design principles as rules

21. **Hierarchy.** Squint at the screen: the title or the one primary action wins. Primary is the ReUI Button `default`, secondary is `outline` or `ghost`, nothing else is filled.
22. **Contrast is spent, not sprinkled.** Strong colour only for the primary action and for destructive actions. Everything secondary stays muted.
23. **Proximity.** Related controls share a row or group. A destructive action is never next to a safe one, has at least 16px of space or its own section, and confirms if it cannot be undone.
24. **Alignment and rhythm.** Shared left edges, `gap-*` from one spacing scale, no one-off margins nudged by eye.
25. **Progressive disclosure.** Show what this step needs, tuck the rest behind a ReUI Collapsible or Accordion. A form over about seven fields becomes steps with a visible "Step 2 of 4".
26. **Feedback within 100ms.** Every tap visibly changes something: pressed state, spinner with the button disabled, then a toast or inline confirmation.
27. **Errors say what happened and what to do next.** Plain words, keep what was typed, validate beside the field on blur, and make 404s and empty results link somewhere useful.
28. **User control.** Reversible actions get Undo (a toast beats a confirm dialog). Every dialog and flow has a visible cancel and closes with Escape. Confirm only what cannot be undone.
29. **Intuitive.** Standard layouts and familiar icons. An icon-only button has an `aria-label` and a tooltip; if the icon is not obvious, add the word.
30. **Iterate with evidence.** Check the real screen at 375px and 1280px, the analytics where they exist, and what testers said. Keep before and after screenshots in the PR.

Sources: Figma, Shopify and Mynavi Tech UI principles articles (read 06/11/2026). The rules are our own wording.
