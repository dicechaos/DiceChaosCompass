@echo off
title Dice Chaos Compass
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Building production bundle...
  call npm.cmd run build
)
node scripts\launch-local-app.mjs
