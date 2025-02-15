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

:: Add all files
git add .

:: Commit changes
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Auto update files"
git commit -m "%commit_msg%"

:: Push to GitHub
git push -u origin main

echo Done!
pause 