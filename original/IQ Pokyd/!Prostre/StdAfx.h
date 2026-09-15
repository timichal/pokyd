// stdafx.h : include file for standard system include files,
//  or project specific include files that are used frequently, but
//      are changed infrequently
//


#if !defined(AFX_STDAFX_H__B5B06BA9_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_)
#define AFX_STDAFX_H__B5B06BA9_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000

#define VC_EXTRALEAN		// Exclude rarely-used stuff from Windows headers

#include <afxwin.h>         // MFC core and standard components
#include <afxext.h>         // MFC extensions
#include <afxdisp.h>        // MFC Automation classes
#include <afxdtctl.h>		// MFC support for Internet Explorer 4 Common Controls
#include <mmsystem.h>
#include <signal.h>

//#include <CRTDBG.H>   //pro zakaz free_dbg

#ifndef _AFX_NO_AFXCMN_SUPPORT
#include <afxcmn.h>			// MFC support for Windows Common Controls
#endif // _AFX_NO_AFXCMN_SUPPORT

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_STDAFX_H__B5B06BA9_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_)

//Pro klavesove zkratky
extern HWND    ghDlg;          // Handle to main dialog box.
extern HACCEL  ghAccelTable;   // Handle to accelerator table.

