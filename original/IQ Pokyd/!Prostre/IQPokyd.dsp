# Microsoft Developer Studio Project File - Name="mfc" - Package Owner=<4>
# Microsoft Developer Studio Generated Build File, Format Version 6.00
# ** DO NOT EDIT **

# TARGTYPE "Win32 (x86) Application" 0x0101

CFG=mfc - Win32 Debug
!MESSAGE This is not a valid makefile. To build this project using NMAKE,
!MESSAGE use the Export Makefile command and run
!MESSAGE 
!MESSAGE NMAKE /f "IQPokyd.mak".
!MESSAGE 
!MESSAGE You can specify a configuration when running NMAKE
!MESSAGE by defining the macro CFG on the command line. For example:
!MESSAGE 
!MESSAGE NMAKE /f "IQPokyd.mak" CFG="mfc - Win32 Debug"
!MESSAGE 
!MESSAGE Possible choices for configuration are:
!MESSAGE 
!MESSAGE "mfc - Win32 Release" (based on "Win32 (x86) Application")
!MESSAGE "mfc - Win32 Debug" (based on "Win32 (x86) Application")
!MESSAGE 

# Begin Project
# PROP AllowPerConfigDependencies 0
# PROP Scc_ProjName ""
# PROP Scc_LocalPath ""
CPP=cl.exe
MTL=midl.exe
RSC=rc.exe

!IF  "$(CFG)" == "mfc - Win32 Release"

# PROP BASE Use_MFC 6
# PROP BASE Use_Debug_Libraries 0
# PROP BASE Output_Dir "Release"
# PROP BASE Intermediate_Dir "Release"
# PROP BASE Target_Dir ""
# PROP Use_MFC 5
# PROP Use_Debug_Libraries 0
# PROP Output_Dir "Release"
# PROP Intermediate_Dir "Release"
# PROP Ignore_Export_Lib 0
# PROP Target_Dir ""
# ADD BASE CPP /nologo /MD /W3 /GX /O2 /D "WIN32" /D "NDEBUG" /D "_WINDOWS" /D "_AFXDLL" /Yu"stdafx.h" /FD /c
# ADD CPP /nologo /MT /W3 /WX /GX /O1 /D "WIN32" /D "NDEBUG" /D "_WINDOWS" /D "_MBCS" /Yu"stdafx.h" /FD /c
# ADD BASE MTL /nologo /D "NDEBUG" /mktyplib203 /win32
# ADD MTL /nologo /D "NDEBUG" /mktyplib203 /win32
# ADD BASE RSC /l 0x405 /d "NDEBUG" /d "_AFXDLL"
# ADD RSC /l 0x405 /d "NDEBUG"
BSC32=bscmake.exe
# ADD BASE BSC32 /nologo
# ADD BSC32 /nologo
LINK32=link.exe
# ADD BASE LINK32 /nologo /subsystem:windows /machine:I386
# ADD LINK32 winmm.lib /nologo /subsystem:windows /machine:I386 /opt:ref
# SUBTRACT LINK32 /pdb:none

!ELSEIF  "$(CFG)" == "mfc - Win32 Debug"

# PROP BASE Use_MFC 6
# PROP BASE Use_Debug_Libraries 1
# PROP BASE Output_Dir "Debug"
# PROP BASE Intermediate_Dir "Debug"
# PROP BASE Target_Dir ""
# PROP Use_MFC 5
# PROP Use_Debug_Libraries 1
# PROP Output_Dir "Debug"
# PROP Intermediate_Dir "Debug"
# PROP Ignore_Export_Lib 0
# PROP Target_Dir ""
# ADD BASE CPP /nologo /MDd /W3 /Gm /GX /ZI /Od /D "WIN32" /D "_DEBUG" /D "_WINDOWS" /D "_AFXDLL" /Yu"stdafx.h" /FD /GZ /c
# ADD CPP /nologo /MTd /W3 /WX /Gm /GX /Zi /D "WIN32" /D "_DEBUG" /D "_WINDOWS" /D "_MBCS" /FR /Yu"stdafx.h" /FD /GZ /c
# ADD BASE MTL /nologo /D "_DEBUG" /mktyplib203 /win32
# ADD MTL /nologo /D "_DEBUG" /mktyplib203 /win32
# ADD BASE RSC /l 0x405 /d "_DEBUG" /d "_AFXDLL"
# ADD RSC /l 0x405 /d "_DEBUG"
BSC32=bscmake.exe
# ADD BASE BSC32 /nologo
# ADD BSC32 /nologo
LINK32=link.exe
# ADD BASE LINK32 /nologo /subsystem:windows /debug /machine:I386 /pdbtype:sept
# ADD LINK32 winmm.lib /nologo /subsystem:windows /debug /machine:I386 /pdbtype:sept
# SUBTRACT LINK32 /pdb:none

!ENDIF 

# Begin Target

# Name "mfc - Win32 Release"
# Name "mfc - Win32 Debug"
# Begin Group "Source Files"

# PROP Default_Filter "cpp;c;cxx;rc;def;r;odl;idl;hpj;bat"
# Begin Source File

SOURCE=.\IQPokyd.cpp
# End Source File
# Begin Source File

SOURCE=.\IQPokyd.rc
# End Source File
# Begin Source File

SOURCE=.\mfcDlg.cpp
# End Source File
# Begin Source File

SOURCE=.\ModalNemodalDlg.cpp
# End Source File
# Begin Source File

SOURCE=.\Nacitani.cpp
# End Source File
# Begin Source File

SOURCE=.\Nastaveni.cpp
# End Source File
# Begin Source File

SOURCE=.\StdAfx.cpp
# ADD CPP /Yc"stdafx.h"
# End Source File
# Begin Source File

SOURCE=.\Text.cpp
# End Source File
# End Group
# Begin Group "Header Files"

# PROP Default_Filter "h;hpp;hxx;hm;inl"
# Begin Source File

SOURCE=.\DebugNastaveni.h
# End Source File
# Begin Source File

SOURCE=.\HlavniNacitani.h
# End Source File
# Begin Source File

SOURCE=.\IQPokyd.h
# End Source File
# Begin Source File

SOURCE=.\mfcDlg.h
# End Source File
# Begin Source File

SOURCE=.\ModalNemodalDlg.h
# End Source File
# Begin Source File

SOURCE=.\Nacitani.h
# End Source File
# Begin Source File

SOURCE=.\Nastaveni.h
# End Source File
# Begin Source File

SOURCE=.\Resource.h
# End Source File
# Begin Source File

SOURCE=.\StdAfx.h
# End Source File
# Begin Source File

SOURCE=.\Text.h
# End Source File
# End Group
# Begin Group "Resource Files"

# PROP Default_Filter "ico;cur;bmp;dlg;rc2;rct;bin;rgs;gif;jpg;jpeg;jpe"
# Begin Source File

SOURCE=.\res\bitmap1.bmp
# End Source File
# Begin Source File

SOURCE=.\res\bitmap2.bmp
# End Source File
# Begin Source File

SOURCE=.\res\bmp00001.bmp
# End Source File
# Begin Source File

SOURCE=.\res\bmp00002.bmp
# End Source File
# Begin Source File

SOURCE=.\res\cursor1.cur
# End Source File
# Begin Source File

SOURCE=.\res\ico00001.ico
# End Source File
# Begin Source File

SOURCE=.\res\icon1.ico
# End Source File
# Begin Source File

SOURCE=.\res\internet.bmp
# End Source File
# Begin Source File

SOURCE=.\res\IQPokyd.ico
# End Source File
# Begin Source File

SOURCE=.\res\IQPokyd.rc2
# End Source File
# Begin Source File

SOURCE=.\res\kyblsoft.bmp
# End Source File
# Begin Source File

SOURCE=.\res\menukone.bmp
# End Source File
# Begin Source File

SOURCE=.\res\menumala.bmp
# End Source File
# Begin Source File

SOURCE=.\res\menunast.bmp
# End Source File
# Begin Source File

SOURCE=.\res\menuopro.bmp
# End Source File
# Begin Source File

SOURCE=.\res\menuvelk.bmp
# End Source File
# Begin Source File

SOURCE=.\res\menuverz.bmp
# End Source File
# Begin Source File

SOURCE=".\res\pozadi-iqpokyd.bmp"
# End Source File
# Begin Source File

SOURCE=.\res\pozadi.bmp
# End Source File
# Begin Source File

SOURCE=.\res\pozadimale.bmp
# End Source File
# Begin Source File

SOURCE=.\res\POZMALE.BMP
# End Source File
# Begin Source File

SOURCE=.\res\TAP26.BMP
# End Source File
# End Group
# Begin Source File

SOURCE=.\res\html1.htm
# End Source File
# Begin Source File

SOURCE=.\manifest.xml
# End Source File
# Begin Source File

SOURCE=.\res\manifest.xml
# End Source File
# Begin Source File

SOURCE=.\ReadMe.txt
# End Source File
# Begin Source File

SOURCE=.\res\tuknuti.wav
# End Source File
# Begin Source File

SOURCE=.\xp.manifest
# End Source File
# End Target
# End Project
