# VibeBug Terminal Demo
# Record with: vhs scripts/demo.tape
# Requires: brew install vhs

Output demo.gif
Output demo.mp4

Set FontSize 15
Set Width 960
Set Height 540
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 50ms

# Title
Type "# VibeBug — the bug tracker for vibe coding"
Enter
Sleep 2s

# Step 1: Initialize project
Type "vb init"
Enter
Sleep 2s

# Step 2: Wrap a failing build
Type "# Wrap any command — failures are captured automatically"
Enter
Sleep 1s
Type "vb npm run build"
Enter
Sleep 4s

# Step 3: Show what keeps breaking
Type "# What keeps breaking?"
Enter
Sleep 1s
Type "vb summary"
Enter
Sleep 5s

# Step 4: Launch dashboard
Type "# See it all in the dashboard"
Enter
Sleep 1s
Type "vb dash"
Enter
Sleep 3s

# Hold final frame
Sleep 2s
