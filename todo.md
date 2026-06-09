```
_____________________________________________________________________________________
Phase 0 — write a proper md file for hand over and specs                            -
-------------------------------------------------------------------------------------
0.1. file structor                                                                  -
0.2  project goal and tragetory                                                     -
0.3  curent step                                                                    -
0.4  core things to remeber that makes you take less time to search and analyze     -

_____________________________________________________________________________________
Phase 1 — Electron Shell                                                            -
-------------------------------------------------------------------------------------
1.1. Electron window opens                                                          @
1.2. Remove all default menus and chrome                                            @
1.3. Custom titlebar (draggable, min/max/close)                                     @
1.4. WebContentsView renders a URL                                                  @
1.5.1.   Address bar controls navigation                                            @
1.5.2.   Address bar suggestions and auto complete                                  -
1.6. Back/forward/reload buttons                                                    #
1.7. Page title and favicon in toolbar                                              -
_____________________________________________________________________________________
Phase 2 — Basic Browser                                                             -
-------------------------------------------------------------------------------------
2.1. Single tab UI                                                                  @
2.2. Multiple tabs                                                                  @
2.3. New tab / close tab                                                            @
2.4. Tab shows favicon and title                                                    @
2.5. Loading indicator/progress bar                                                 @
2.6. Custom new tab page                                                            m
2.7. basic controls :                                                               -
.1.      ctrl + t new tab                                                           -
.2.      ctrl + w close focused tab                                                 -
.3.      ctrl + shift + t open the last closed tab                                  -                
.4.      ctrl + h open history panel (inside the settings panel ,should be new jsx) -
2.8 add a save website and make it always visible under adress bar , like brave     -
_____________________________________________________________________________________
Phase 3 — Layout System                                                             -
-------------------------------------------------------------------------------------
3.1. Basic resizable panels (top browser, bottom terminal)                          -
3.2. Draggable panel dividers                                                       -
3.3. GoldenLayout integration                                                       -
3.4. Panels dockable and rearrangeable                                              -
3.5. Panels detachable into floating OS windows                                     -
3.6. Layout state saves and restores on restart                                     -
_____________________________________________________________________________________
Phase 4 — Session Isolation                                                         -
-------------------------------------------------------------------------------------
4.1. Named partitions per tab                                                       -
4.2. Verify cookie isolation between partitions                                     -
4.3. Persist partitions to disk                                                     -
4.4. Memory-only partition option                                                   -
4.5. Save/restore full session on restart                                           -
4.6. Session list UI (sidebar or panel)                                             -
4.7. Switch between sessions instantly                                              -
4.8. Session metadata (name, icon, last used)                                       -
_____________________________________________________________________________________
Phase 5 — Browser Power Features                                                    -
-------------------------------------------------------------------------------------
5.1. Inject custom CSS into any page                                                -
5.2. Inject custom JS into any page                                                 -
5.3. Bypass CORS via session flags                                                  -
5.4. Disable CSP via session flags                                                  -
5.5. Custom protocol handler (myapp://)                                             -
5.6. Hide/minimize session without destroying it                                    -
5.7. Headless/offscreen sessions in background                                      -
5.8. Throttle background session GPU usage                                          -
5.9. Compare two sessions side by side                                              -
_____________________________________________________________________________________
Phase 6 — Terminal                                                                  -
-------------------------------------------------------------------------------------
6.1. xterm.js panel renders                                                         -
6.2. WebGL renderer addon enabled                                                   -
6.3. Resize terminal panel                                                          -
6.4. Your Ratatui TUI as locked shell                                               -
6.5. Auto restart TUI on crash                                                      -
6.6. Canvas overlay for Kitty graphics protocol                                     -
6.7. Spawn any CLI tool from terminal                                               -
6.8. Full sudo/admin access                                                         -
_____________________________________________________________________________________
Phase 7 — Scripting & External Processes                                            -
-------------------------------------------------------------------------------------
7.1. Spawn Python scripts from Node.js                                              -
7.2. Spawn Rust binaries from Node.js                                               -
7.3. Two way JSON via stdin/stdout                                                  -
7.4. Expose external scripts as local HTTP servers                                  -
7.5. Run any OS process                                                             -
7.6. Script output streams to terminal panel                                        -
_____________________________________________________________________________________
Phase 8 — Inspection & CDP                                                          -
-------------------------------------------------------------------------------------
8.1. Enable remote debugging port on Chromium                                       -
8.2. Connect Playwright to same instance                                            -
8.3. DOM inspector panel                                                            -
8.4. DOM manipulation via CDP                                                       -
8.5. Network traffic interception                                                   -
8.6. Network traffic logging UI                                                     -
8.7. Input simulation (clicks, typing, scrolling)                                   -
8.8. Screenshot capture                                                             -
8.9. Console access panel                                                           -
8.10. Full CDP control layer                                                        -
_____________________________________________________________________________________
Phase 9 — Auth & Session Management                                                 -
-------------------------------------------------------------------------------------
9.1. Save and restore full sessions                                                 -
9.2. Automate login flows via Playwright                                            -
9.3. Secure credential storage via safeStorage                                      -
9.4. Extract and manage auth tokens                                                 -
9.5. Full cookie management UI (get, set, delete)                                   -
9.6. localStorage and sessionStorage access UI                                      -
9.7. Session export/import                                                          -
_____________________________________________________________________________________
Phase 10 — Recording & Node System                                                  -
-------------------------------------------------------------------------------------
10.1. Data structure for a node                                                     -
10.2. Every user action creates a node                                              -
10.3. Every network event captured per node                                         -
10.4. DOM snapshot stored per node                                                  -
10.5. Screenshot stored per node                                                    -
10.6. Cookies and localStorage stored per node                                      -
10.7. Nodes link into a tree structure                                              -
10.8. Save node tree to disk                                                        -
10.9. Load node tree on restart                                                     -
10.10. Fork at any node                                                             -
10.11. Replay sequence from any node                                                -
10.12. Jump to any past state instantly                                             -
10.13. Branch comparison (run same path on two sessions)                            -
10.14. Element picker mode (click element on page to select it)                     -
10.15. Selected element gets a label/name                                           -
10.16. Marked elements saved to node JSON file                                      -
10.17. Element selector stored (CSS selector + XPath + position)                    -
10.18. Element value snapshot stored (text, attributes, innerHTML)                  -
10.19. View all marked elements for a node in sidebar                               -
_____________________________________________________________________________________
Phase 11 — Node Graph UI                                                            -
-------------------------------------------------------------------------------------
11.1. React Flow basic graph renders                                                -
11.2. Nodes show thumbnail screenshot                                               -
11.3. Click node jumps to that state                                                -
11.4. Branching renders like git graph                                              -
11.5. Pan/zoom/drag works                                                           -
11.6. Node detail panel (screenshot, DOM, network log)                              -
11.7. Node detail shows marked elements list                                        -
11.8. Click marked element highlights it on screenshot                              -
11.9. Edit marked element label inline                                              -
11.10. Delete marked element from node                                              -
11.11. Export node marked elements as JSON                                          -
11.12. Migrate to Pixi.js when/if performance needed                                -
11.13. Visual diff between two nodes                                                -
11.14. Diff view highlights changes in marked elements between nodes                -
_____________________________________________________________________________________
Phase 12 — Node Graph Runtime                                                       -
-------------------------------------------------------------------------------------
12.1. Execute actions from any node                                                 -
12.2. Run node sequence forward/backward                                            -
12.3. Pause execution mid-sequence                                                  -
12.4. Step through actions one by one                                               -
12.5. Loop a node sequence N times                                                  -
12.6. Branch execution at runtime (choose next node interactively)                  -
12.7. Record new actions into an existing node branch                               -
12.8. Merge two branches back into one                                              -
12.9. Replay with variable substitution (e.g., {{username}})                        -
12.10. Validate node sequence against current live DOM                              -
_____________________________________________________________________________________
Phase 13 — Collaborative & Multi-User                                               -
-------------------------------------------------------------------------------------
13.1. Share a node tree via URL                                                     -
13.2. Export node tree as JSON file                                                 -
13.3. Import node tree from JSON                                                    -
13.4. Merge two node trees intelligently                                            -
13.5. Real-time collaboration on same node tree (CRDT)                              -
13.6. User comments on nodes                                                        -
13.7. Tag nodes (e.g., "login", "checkout", "error")                                -
13.8. Fork another user's published node tree                                       -
13.9. Publish node tree read-only                                                   -
13.10. Remote replay (one user navigates, others watch)                             -
_____________________________________________________________________________________
Phase 14 — Advanced Storage & Sync                                                  -
-------------------------------------------------------------------------------------
14.1. SQLite backend for node trees (instead of flat JSON)                          -
14.2. Full-text search over node actions, URLs, DOM snapshots                       -
14.3. Tag search + filter UI                                                        -
14.4. Automatic node expiration / archiving                                         -
14.5. Sync node trees across machines (WebDAV / S3 / custom server)                 -
14.6. Version history for each node tree (time-travel on the tree itself)           -
14.7. Restore previous tree version                                                 -
14.8. Diff between two tree versions                                                -
14.9. Blob storage for screenshots / DOM snapshots (deduplicated)                   -
14.10. Encrypted node trees (password + safeStorage)                                -
_____________________________________________________________________________________
Phase 15 — Automation & CI/CD                                                       -
-------------------------------------------------------------------------------------
15.1. Run node tree from CLI                                                        -
15.2. Run node tree headless (no UI)                                                -
15.3. Export node tree as Playwright test                                           -
15.4. Export node tree as Puppeteer script                                          -
15.5. Export node tree as plain JSON steps                                          -
15.6. CI integration (GitHub Actions, GitLab CI)                                    -
15.7. Scheduled node tree runs (cron)                                               -
15.8. Email/Slack notification on node tree failure                                 -
15.9. Screenshot diff on failure                                                    -
15.10. Performance metrics per node (load time, CPU, memory)                        -
_____________________________________________________________________________________




# means still wip or sth is off
@ means done
- means unread or not done yet
m means igonored stands for meh
```



