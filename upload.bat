@echo off
echo Uploading to GitHub...

:: Configure Git (only needed first time)
git config --global user.name "far9ouch"
git config --global user.email "far9ouch07@gmail.com"

:: Initialize git if not already done
if not exist .git (
    git init
    git remote add origin https://github.com/far9ouch/test-app.git
)

:: Create and switch to main branch if it doesn't exist
git checkout -b main 2>nul

:: Add all files
git add .

:: Commit changes
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Auto update files"
git commit -m "%commit_msg%"

:: Force push to GitHub (use with caution - only for initial setup)
git push -f origin main

echo Done!
pause 