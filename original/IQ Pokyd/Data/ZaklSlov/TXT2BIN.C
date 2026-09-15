/* IQ Pokyd - txt2bin.c - pøevod dosud neskloòovaného slovníku v textové
   podobì do binární podoby
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

#define KODOVACI_ZNAK (char)'K'
#define DELKA_INFORMACI 500
#define DELKA_FRONTY 500

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <conio.h>

FILE *f1,*f2;

//#include "\!iqpokyd\aplikace\vzory\sklonov.pr"

#define BYTE unsigned char
#define WORD unsigned short
#define DWORD unsigned long

DWORD pozice,celkdelka,pocetchyb=0;
signed long pocetusetrenychbajtu=0;
char slovoted[1000],predchozislovo[1000],nahodnykodovaciklic;
char hlavicka[5000],skutecneslovo[DELKA_INFORMACI];
char kontrolnisoucet1,kontrolnisoucet2,znak;
BYTE konecradku,vzor,vid;
char pocetzbytecnosti,pozzbyt;
DWORD pocetslov=0,delkahlavicky,radek;

#include "txt2bin.fu"

void main(void) {
if ((f1=fopen("SLOVNIK.IQZ","rb")) == NULL) {
  printf("Chyba! Nelze otevrit vstupni soubor SLOVNIK.IQZ!"); exit(0);
 }
if ((f2=fopen("SLOVNIK.IQP","wb")) == NULL) {
  printf("Chyba! Nelze otevrit vystupni soubor SLOVNIK.IQP!"); fclose(f1); exit(0);
 }

predchozislovo[0]=0;

printf("Prevadim...\n");

strcpy(hlavicka,"IQ Pokyd v0.15 - zakladni slovnik - Ales Janda (C) KYBLSoft 1999-2005");

srand(time(NULL));
pozice=strlen(hlavicka)+1;

pocetzbytecnosti=rand()%100;
hlavicka[pozice++]=pocetzbytecnosti^'I';
for (pozzbyt=0; pozzbyt < pocetzbytecnosti; pozzbyt++)
 hlavicka[pozice++]=(char)rand();       //zbytecnosti (pro zmateni hackera)

nahodnykodovaciklic=(char)rand();
hlavicka[pozice++]=nahodnykodovaciklic;

hlavicka[pozice++]=1;                   //signatura zakladniho slovniku

hlavicka[pozice++]=0;
 hlavicka[pozice++]=15;                  //verze IQ Pokydu 0.15

hlavicka[pozice++]=0;                   //verze slovniku 0 (nekompatibilni)

hlavicka[pozice++]=KODOVACI_ZNAK;       //hodnota KODOVACI_ZNAK

delkahlavicky=pozice;

fwrite(hlavicka,delkahlavicky+5,1,f2);
                 //jeste 3 bajty na pocet slov a 2 bajty na kontrolni soucty


kontrolnisoucet1=0; kontrolnisoucet2=0;
radek=0;
goto ZACATEK;

DOJDINAKONECRADKU:
switch(getc(f1)) {
  case EOF: goto KONEC;
  case '\n': break;
  default: goto DOJDINAKONECRADKU;
 }

ZACATEK:
radek++; vid=255;

switch(getc(f1)) {
  case '.': break;
  case EOF: goto KONEC;
  default: printf("Chyba! Chybi tecka na zacatku radku!"); CHYBA(); goto ZACATEK;
 }

switch(PRECTI_SLOVO()) {
  case 0: break;
  case 1: printf("Chyba! Neuplny radek!"); CHYBA(); goto ZACATEK;
  case 2: goto KONEC;
 }
UPRAV_SLOVO_PRO_IQPOKYD(slovoted);
strcpy(skutecneslovo,slovoted);

if (getc(f1) != ' ') { printf("Chyba! Chybejici mezera za ':'!"); CHYBA(); goto DOJDINAKONECRADKU; }
konecradku=PRECTI_SLOVO();

if (strcmp(slovoted,"1") == 0) {
  if (konecradku == 1) { printf("Chyba! Prilis malo parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
  konecradku=PRECTI_SLOVO();

       if (strcmp(slovoted,"pán") == 0) vzor=1;
  else if (strcmp(slovoted,"hrad") == 0) vzor=2;
  else if (strcmp(slovoted,"muž") == 0) vzor=3;
  else if (strcmp(slovoted,"stroj") == 0) vzor=4;
  else if (strcmp(slovoted,"pøedseda") == 0) vzor=5;
  else if (strcmp(slovoted,"soudce") == 0) vzor=6;
  else if (strcmp(slovoted,"žena") == 0) vzor=7;
  else if (strcmp(slovoted,"rùže") == 0) vzor=8;
  else if (strcmp(slovoted,"píseò") == 0) vzor=9;
  else if (strcmp(slovoted,"kost") == 0) vzor=10;
  else if (strcmp(slovoted,"mìsto") == 0) vzor=11;
  else if (strcmp(slovoted,"moøe") == 0) vzor=12;
  else if (strcmp(slovoted,"kuøe") == 0) vzor=13;
  else if (strcmp(slovoted,"stavení") == 0) vzor=14;
  else if (strcmp(slovoted,"rony") == 0) vzor=15;
  else if (strcmp(slovoted,"idea") == 0) vzor=16;
  else if (strcmp(slovoted,"téma") == 0) vzor=17;
  else if (strcmp(slovoted,"kalhoty") == 0) vzor=18;
  else if (strcmp(slovoted,"data") == 0) vzor=19;
  else if (strcmp(slovoted,"housle") == 0) vzor=20;
  else if (strcmp(slovoted,"madam") == 0) vzor=21;
  else if (strcmp(slovoted,"kupé") == 0) vzor=22;
  else { printf("Chyba! Neznamy vzor!"); CHYBA(); goto DOJDINAKONECRADKU; }

  if (konecradku == 0) {
    if (PRECTI_SLOVO() == 0) { printf("Chyba! Prilis mnoho parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
    UPRAV_SLOVO_PRO_IQPOKYD(slovoted);
    if (PREVED_TEXTOVE_KONSTANTY_VYJIMEK_NA_BINARNI() == 1) goto DOJDINAKONECRADKU; //chyba
   }
  else slovoted[0]=0;                 //zadne doplnujici informace
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"2") == 0) {
  if (konecradku == 1) { printf("Chyba! Prilis malo parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
  konecradku=PRECTI_SLOVO();

       if (strcmp(slovoted,"mladý") == 0) vzor=31;
  else if (strcmp(slovoted,"jarní") == 0) vzor=32;
  else if (strcmp(slovoted,"matèin") == 0) vzor=33;
  else if (strcmp(slovoted,"otcùv") == 0) vzor=34;
  else if (strcmp(slovoted,"super") == 0) vzor=35;
  else { printf("Chyba! Neznamy vzor!"); CHYBA(); goto DOJDINAKONECRADKU; }

  if (konecradku == 0) {
    if (PRECTI_SLOVO() == 0) { printf("Chyba! Prilis mnoho parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
    UPRAV_SLOVO_PRO_IQPOKYD(slovoted);
    if (PREVED_TEXTOVE_KONSTANTY_VYJIMEK_NA_BINARNI() == 1) goto DOJDINAKONECRADKU; //chyba
   }
  else slovoted[0]=0;                 //zadne doplnujici informace
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"5") == 0) {
  if (konecradku == 1) { printf("Chyba! Prilis malo parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
  konecradku=PRECTI_SLOVO();

       if (strcmp(slovoted,"nese") == 0) vzor=61;
  else if (strcmp(slovoted,"bere") == 0) vzor=62;
  else if (strcmp(slovoted,"maže") == 0) vzor=63;
  else if (strcmp(slovoted,"peèe") == 0) vzor=64;
  else if (strcmp(slovoted,"umøe") == 0) vzor=65;
  else if (strcmp(slovoted,"tiskne") == 0) vzor=66;
  else if (strcmp(slovoted,"mine") == 0) vzor=67;
  else if (strcmp(slovoted,"zaène") == 0) vzor=68;
  else if (strcmp(slovoted,"kryje") == 0) vzor=69;
  else if (strcmp(slovoted,"kupuje") == 0) vzor=70;
  else if (strcmp(slovoted,"prosí") == 0) vzor=71;
  else if (strcmp(slovoted,"trpí") == 0) vzor=72;
  else if (strcmp(slovoted,"sází") == 0) vzor=73;
  else if (strcmp(slovoted,"dìlá") == 0) vzor=74;
  else { printf("Chyba! Neznamy vzor!"); CHYBA(); goto DOJDINAKONECRADKU; }

  if (konecradku == 1) {
    vid=1;                               //standardne nedokonavy vid
    slovoted[0]=0;                       //zadne doplnujici informace
    ZAPIS_NOVE_SLOVO(); goto DALSI;
   }
  konecradku=PRECTI_SLOVO();
       if (strcmp(slovoted,"nedok") == 0) vid=1;
  else if (strcmp(slovoted,"dok") == 0) vid=2;
  else if (strcmp(slovoted,"pøedložka") == 0) vid=3;
  else { printf("Chyba! Spatny vid!"); CHYBA(); goto DOJDINAKONECRADKU; }

  if (konecradku == 0) {
    if (PRECTI_SLOVO() == 0) { printf("Chyba! Prilis mnoho parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
    UPRAV_SLOVO_PRO_IQPOKYD(slovoted);
    if (PREVED_TEXTOVE_KONSTANTY_VYJIMEK_NA_BINARNI() == 1) goto DOJDINAKONECRADKU; //chyba
   }
  else slovoted[0]=0;                 //zadne doplnujici informace
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"6") == 0) {
  if (konecradku == 1) { printf("Chyba! Prilis malo parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
  konecradku=PRECTI_SLOVO();

       if (strcmp(slovoted,"místa_kde") == 0) vzor=81;
  else if (strcmp(slovoted,"místa_kam") == 0) vzor=82;
  else if (strcmp(slovoted,"èasu") == 0) vzor=83;
  else if (strcmp(slovoted,"zpùsobu") == 0) vzor=84;
  else if (strcmp(slovoted,"otázky") == 0) vzor=85;
  else { printf("Chyba! Neznamy vzor!"); CHYBA(); goto DOJDINAKONECRADKU; }

  if (konecradku == 0) {
    if (PRECTI_SLOVO() == 0) { printf("Chyba! Prilis mnoho parametru!"); CHYBA(); goto DOJDINAKONECRADKU; }
    UPRAV_SLOVO_PRO_IQPOKYD(slovoted);
    if (PREVED_TEXTOVE_KONSTANTY_VYJIMEK_NA_BINARNI() == 1) goto DOJDINAKONECRADKU; //chyba
   }
  else slovoted[0]=0;                 //zadne doplnujici informace
  ZAPIS_NOVE_SLOVO();
 }

else if (strcmp(slovoted,"7") == 0) {
  vzor=90;
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"8") == 0) {
  vzor=100;
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"9") == 0) {
  vzor=110;
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"10") == 0) {
  vzor=120;
  ZAPIS_NOVE_SLOVO();
 }
else if (strcmp(slovoted,"11") == 0) {
  vzor=121;
  ZAPIS_NOVE_SLOVO();
 }
else {
  printf("Chyba! Neplatne cislo slovniho druhu!"); CHYBA(); goto DOJDINAKONECRADKU;
 }

DALSI:
pocetslov++;
if (pocetslov >= (DWORD)((DWORD)255*(DWORD)255)) {
  printf("Prilis mnoho slov! (Maximalne %u slov.)",255*255); CHYBA(); goto KONEC;
 }
goto ZACATEK;

KONEC:
putc(kontrolnisoucet1,f2); putc(kontrolnisoucet2,f2);

fclose(f1); fclose(f2);

f2=fopen("SLOVNIK.IQP","rb+");
fread(hlavicka,delkahlavicky,1,f2);

hlavicka[delkahlavicky]=((char)(pocetslov>>16));
hlavicka[delkahlavicky+1]=((char)(pocetslov>>8));
hlavicka[delkahlavicky+2]=((char)pocetslov);

kontrolnisoucet1=0; kontrolnisoucet2=0;

for (pozice=0; pozice < (delkahlavicky+3); pozice++) {
  SPOCITEJ_KONTROLNI_SOUCET(hlavicka[pozice]);
 }

hlavicka[delkahlavicky-6]^='I';
hlavicka[delkahlavicky-5]^='K'; hlavicka[delkahlavicky-5]+=nahodnykodovaciklic;
hlavicka[delkahlavicky-4]^='K'; hlavicka[delkahlavicky-4]+=nahodnykodovaciklic;
hlavicka[delkahlavicky-3]^='K'; hlavicka[delkahlavicky-3]+=nahodnykodovaciklic;
hlavicka[delkahlavicky-2]^='K'; hlavicka[delkahlavicky-2]+=nahodnykodovaciklic;
hlavicka[delkahlavicky-1]^='K'; hlavicka[delkahlavicky-1]+=nahodnykodovaciklic;

znak=((char)(pocetslov>>16)); hlavicka[delkahlavicky]=(znak^'K')+nahodnykodovaciklic;
znak=((char)(pocetslov>>8)); hlavicka[delkahlavicky+1]=(znak^'K')+nahodnykodovaciklic;
znak=((char)pocetslov); hlavicka[delkahlavicky+2]=(znak^'K')+nahodnykodovaciklic;

hlavicka[delkahlavicky+3]=kontrolnisoucet1;
hlavicka[delkahlavicky+4]=kontrolnisoucet2;

fseek(f2,0,SEEK_SET);
fwrite(hlavicka,delkahlavicky+5,1,f2);

fclose(f2);

printf("Hotovo. Prevedeno %lu slov (usetreno %ld bajtu).\n",pocetslov,pocetusetrenychbajtu);
if (pocetchyb > 0) printf("\n*** NALEZENY CHYBY:  %lu ***\n",pocetchyb);

}
