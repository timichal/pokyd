#if !defined(AFX_NACITANI_H__5ECF0782_A181_4A2D_AC49_C6390307BAB8__INCLUDED_)
#define AFX_NACITANI_H__5ECF0782_A181_4A2D_AC49_C6390307BAB8__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000
// Nacitani.h : header file
//

/////////////////////////////////////////////////////////////////////////////
// CNacitani dialog

class CNacitani : public CDialog
{
// Construction
public:
	CNacitani(CWnd* pParent = NULL);   // standardni konstruktor
	~CNacitani(void);     // standardni destruktor

// Dialog Data
	//{{AFX_DATA(CNacitani)
	enum { IDD = IDD_NACITANI };
		// NOTE: the ClassWizard will add data members here
	//}}AFX_DATA


// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CNacitani)
	protected:
	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:

	// Generated message map functions
	//{{AFX_MSG(CNacitani)
	virtual void OnCancel();
	afx_msg BOOL OnHelpInfo(HELPINFO* pHelpInfo);
	afx_msg HBRUSH OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor);
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_NACITANI_H__5ECF0782_A181_4A2D_AC49_C6390307BAB8__INCLUDED_)
