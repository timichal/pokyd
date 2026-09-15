#if !defined(AFX_TEXT_H__DC662D25_092B_48F4_9544_95EA20C17DAC__INCLUDED_)
#define AFX_TEXT_H__DC662D25_092B_48F4_9544_95EA20C17DAC__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000
// Text.h : header file
//

/////////////////////////////////////////////////////////////////////////////
// CText dialog

class CText : public CDialog
{
// Construction
public:
	CText(CWnd* pParent = NULL);   // standard constructor
  ~CText(void);                  // standard destructor

  CString text;
  CString nadpis;
  HWND m_HWNDtextu;

// Dialog Data
	//{{AFX_DATA(CText)
	enum { IDD = IDD_TEXT };
		// NOTE: the ClassWizard will add data members here
	//}}AFX_DATA


// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CText)
	protected:
	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:

	// Generated message map functions
	//{{AFX_MSG(CText)
	virtual BOOL OnInitDialog();
	afx_msg BOOL OnHelpInfo(HELPINFO* pHelpInfo);
	afx_msg void OnClose();
	afx_msg HBRUSH OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor);
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_TEXT_H__DC662D25_092B_48F4_9544_95EA20C17DAC__INCLUDED_)
