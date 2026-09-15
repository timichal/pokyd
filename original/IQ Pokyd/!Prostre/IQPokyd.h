// IQPokyd.h : main header file for the MFC application
//

#include "resource.h"		// main symbols
#include "mfcDlg.h"

class Typ_slova;
class Struktura_vety;
class RozvrzeniVet;

#include "\!iqpokyd\!zdrojak\aplikace\hlavicky.in"

extern DWORD g_barvapozadizadavanivety,g_barvatextuhlavnihookna;
extern DWORD g_barvatextucloveka,g_barvatextupocitace;
extern HBRUSH g_stetecpozadizadavanivety,g_stetecpozadihlavnihookna;
extern HBRUSH g_stetecpozadipodokna,g_stetecbilepozadi;
extern HBITMAP g_obrazekpozadihlavnihookna;
extern HWND g_HWNDhlavickovychtextu[3];

extern CStatic *g_handletext1,*g_handletext2,*g_handletext3;
extern HWND g_HWNDpodokna,g_HWNDhlavnihookna;
extern HINSTANCE g_instanceprogramu;
extern CWnd *g_CWndhlavnihookna;
extern HDC g_HDChlavnihookna;
extern BYTE g_bezivlaknoprocent,g_bezivlaknoprocesu,g_bezivlaknohlasek;
extern BYTE g_bezivlaknoefektu,g_zobrazenahlaska,g_akceefektu;
extern BYTE g_zavritvlaknoprocesu,g_zavritvlaknoprocent,g_zavritvlaknohlasek,g_zavritvlaknoefektu;
extern HANDLE g_handlevlaknaprocesu,g_handlevlaknaprocent,g_handlevlaknahlasek,g_handlevlaknaefektu;
extern BYTE g_nestandardniukonceni;
extern char g_zobrazitnastaveni;
extern char *g_aktualnivetacloveka,*g_predchozivetacloveka,g_odpovedpocitace[MAX_DELKA_ODPOVEDI_POCITACE+1];
extern CString g_zaznamrozhovoru;
extern CMfcDlg g_MfcDlghlavniokno;

extern Typ_slova g_prostorslovviqpodminkach[10];
extern Struktura_vety g_vetacloveka;
extern Nastaveni g_nastaveni;
extern IQPokydWav g_tuknuti;
extern RozvrzeniVet g_poslednich100vet;

extern char *debug_poslednipodmetcloveka,*debug_posledniprisudekcloveka,*debug_poslednipredmetcloveka;

class Typ_slova {
  public:
  WORD pocetslov;

  char *vlastnislovo;

  WORD *id_slova; BYTE *vzor; BYTE *slovnidruh; char **vnoreni; char **predpona;

  BYTE *pad,*osoba,*cislo,*cas,*rod,*zivotnost,*cislopredmetu;
  BYTE *rodpredmetu,*vid,*tvar,*pridavek;
  BYTE *zapor;

  Typ_slova(void);       //konstruktor
  ~Typ_slova(void);       //destruktor
  void VYTVOR_NOVY(WORD kolik);
  void VYMAZ_OBSAH(void);
  void VYMAZ_POSLEDNI_POZICI(void);
  void VYNULUJ_POCET_SLOV(void);
  void NASTAV_POCATECNI_HODNOTY(WORD pozice);
  void PRIPOJ(Typ_slova copripojit);
  void PRIPOJ_JEDEN_VYZNAM(Typ_slova copripojit,WORD poziceslova);
  void VYTAHNI_JEDNO_SLOVO_Z_TYP_SLOVA(Typ_slova puvslova,WORD poziceslova);
  void Typ_slova::ZKOPIRUJ_JEDNO_SLOVO_Z_TYP_SLOVA(Typ_slova zdroj,WORD odkud,WORD kam);
  void ZKOPIRUJ_JEDNO_SLOVO_Z_TYP_SLOVA(WORD odkud,WORD kam);
  void UPRAV_VZOR(BYTE novyvzor,WORD pozice);
 };

class Struktura_vety {
  public:
  WORD pocetslov;

  BYTE typ_vety;
  #define _veta_oznamovaci_ 0
  #define _veta_tazaci_ 1
  #define _veta_rozkazovaci_ 2

  Typ_slova podmet;
  WORD pozicepodmetu;

  Typ_slova prisudek;
  WORD poziceprisudku;

  Typ_slova predmet;
  WORD pozicepredmetu;

  Typ_slova slova[MAX_POCET_SLOV_CLOVEKA];

  void VYNULUJ_HODNOTY(void);
 };

class Nastaveni {
  public:
  BYTE pohlavicloveka;     //0...muz, 1...zena
  BYTE pohlavipocitace;
  char jmenocloveka[101];
  char jmenopocitace[101];
  BYTE charakter;
    //1 - naivni, 2 - klidny, 3 - prumerny, 4 - neduverivy
    //5 - naladovy, 6 - vybusny, 0 - stroj
  BYTE nalada;
    //1 - vyborna, 2 - dobra, 3 - normalni, 4 - spatna, 5 - hrozna

  BYTE ukladatrozhovor;      //0...ne, 1...ano
  BYTE pouzivatzvuky;      //0...ne, 1...ano
  BYTE pouzivatefekty;      //0...ne, 1...ano
  BYTE spisovnacestina;      //0...ne, 1...ano
  BYTE zobrazovatpopisky;      //0...ne, 1...ano

  BYTE debug_rychleukoncovani;      //0...ne, 1...ano
  BYTE debug_tolerancepravopisu;
  BYTE debug_pravopisnarekurze;

  BYTE naladabody;

  BYTE emulovatklavesnici;      //0...neemulovat, 1...ceskou, 2...slovenskou
  BYTE klavesniceqwerty;
  BYTE standardnikurzor;

  BYTE prikaz_readonlymod;
  BYTE prikaz_nezobrazovatpozadi;

  Nastaveni(void);
  ~Nastaveni(void);
  void SPOCITEJ_NALADABODY_Z_NALADY(void);
  void SPOCITEJ_NALADU_PODLE_NALADABODY(void);
  void ZKOPIRUJ_SEM(Nastaveni zdroj);
  void NASTAV_STANDARDNE(void);
 };

class IQPokydWav {

  DWORD CTI_CISLO(BYTE kolik,char *retezec);
  void PIS_CISLO(DWORD cislo, int NA_KOLIK_MIST,char *retezec);

  public:
  WORD aktualnipocetzvuku;

  char *zvuky[MAX_POCET_ZVUKU_TUKNUTI];

  void VYTVOR_PRVNI(void);
  void VYTVOR_DALSI(WORD ktery);
  void DOVYTVOR_VSECHNY_ZVUKY_TUKNUTI(void);
 };

class RozvrzeniVet {

  public:
  CString vety[100];
  char puvodcevety[100];
  
  int pocetzobrazenychvet;

  RozvrzeniVet();
  void PRIDEJ_VETU(char *veta, char puvodce);
 };

extern DWORD debug_pocetalokovani,debug_maxpocetvsechslov;
extern DWORD g_pocetodpovedipocitace,g_pocetslovvzakladnidatabazi,g_pocetiqpodminek;
extern DWORD g_pocetrecenychvet;



#if !defined(AFX_MFC_H__B5B06BA5_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_)
#define AFX_MFC_H__B5B06BA5_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000

#ifndef __AFXWIN_H__
	#error include 'stdafx.h' before including this file for PCH
#endif

/////////////////////////////////////////////////////////////////////////////
// CMfcApp:
// See IQPokyd.cpp for the implementation of this class
//

class CMfcApp : public CWinApp
{
public:
	CMfcApp();

// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CMfcApp)
	public:
        BOOL ProcessMessageFilter(int code, LPMSG lpMsg);
	virtual BOOL InitInstance();
	virtual BOOL ExitInstance();
	//}}AFX_VIRTUAL

// Implementation

	//{{AFX_MSG(CMfcApp)
		// NOTE - the ClassWizard will add and remove member functions here.
		//    DO NOT EDIT what you see in these blocks of generated code !
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};


/////////////////////////////////////////////////////////////////////////////

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_MFC_H__B5B06BA5_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_)

