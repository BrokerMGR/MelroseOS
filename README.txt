MelroseOS GitHub-Relative BAT Workflow - Batch 01

IMPORTANT:
These BAT files DO NOT build at D:\MelroseOS.

They automatically detect the Git repository root with:
    git rev-parse --show-toplevel

Recommended placement:
    <your MelroseOS repo>\
        .git\
        Build\
            01_Create_Repository_Structure.bat
            02_Create_Source_Batch01.bat

Run:
    01_Create_Repository_Structure.bat
    02_Create_Source_Batch01.bat

All generated folders and files are created INSIDE the detected Git repository.

Batch 01 creates:
    AppsScript\Core\CORE-00_Bootstrap.gs
    AppsScript\Core\CORE-01_Config.gs
    AppsScript\Core\CORE-02_Constants.gs
    AppsScript\Core\CORE-03_Utilities.gs
    AppsScript\Core\CORE-04_Logging.gs

Existing source files are skipped and are not overwritten.
