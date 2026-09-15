#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>

#define KODOVACI_ZNAK (char)'K'

#define BYTE unsigned char
#define WORD unsigned short
#define DWORD unsigned long

char radek[10001],slovo[100],vystup[100],vystupniradek[10001];
char hlavicka[5000],prostoridslov[14],znak;
WORD pozicenaradku,pocetpodminek,pocetzavorek;
DWORD poziceradku,delkahlavicky,pozice,delkaradku;
FILE *f1,*f2;
BYTE nahodnykodovaciklic,kontrolnisoucet1=0,kontrolnisoucet2=0;


void UPRAV_SLOVO_PRO_IQPOKYD(char *retezec) {
int poz1,poz2,celkem=strlen(retezec);
char *pomocslovo;
  pomocslovo=malloc(celkem+celkem/2);

  if (celkem >= 60) {
    printf("Interni chyba!"); exit(0);
   }

  for (poz1=0,poz2=0; poz1 < celkem; poz1++,poz2++) {
    if (strncmp(retezec+poz1,"ch",2) == 0) { pomocslovo[poz2]='*'; poz1++; continue; }
    if (strncmp(retezec+poz1,"di",2) == 0) { pomocslovo[poz2]='ï'; continue; }
    if (strncmp(retezec+poz1,"ti",2) == 0) { pomocslovo[poz2]=''; continue; }
    if (strncmp(retezec+poz1,"ni",2) == 0) { pomocslovo[poz2]='ò'; continue; }
    if (strncmp(retezec+poz1,"dí",2) == 0) { pomocslovo[poz2]='ï'; continue; }
    if (strncmp(retezec+poz1,"tí",2) == 0) { pomocslovo[poz2]=''; continue; }
    if (strncmp(retezec+poz1,"ní",2) == 0) { pomocslovo[poz2]='ò'; continue; }
    if (strncmp(retezec+poz1,"dì",2) == 0) { pomocslovo[poz2]='ï'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"tì",2) == 0) { pomocslovo[poz2]=''; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"nì",2) == 0) { pomocslovo[poz2]='ò'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"bì",2) == 0) { pomocslovo[poz2]='B'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"fì",2) == 0) { pomocslovo[poz2]='F'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"mì",2) == 0) { pomocslovo[poz2]='M'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"pì",2) == 0) { pomocslovo[poz2]='P'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"qì",2) == 0) { pomocslovo[poz2]='Q'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"vì",2) == 0) { pomocslovo[poz2]='V'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    if (strncmp(retezec+poz1,"wì",2) == 0) { pomocslovo[poz2]='W'; poz2++; pomocslovo[poz2]='e'; poz1++; continue; }
    pomocslovo[poz2]=retezec[poz1];
   }
  pomocslovo[poz2]=0;
  strcpy(retezec,pomocslovo);

  free(pomocslovo);
 }

void SPOCITEJ_KONTROLNI_SOUCET(char zceho) {
  kontrolnisoucet1+=zceho;
  kontrolnisoucet2^=zceho; kontrolnisoucet2+=zceho;
 }

void PRIPOJ(char *buffer,char co) {
int delka=strlen(buffer);
  buffer[delka]=co; buffer[delka+1]=0;
 }

BYTE PRECTI_RADEK(void) {
WORD poz=0;
int znak;
  for (poz=0; ; poz++) {
    znak=getc(f1);
    if (znak == '\r' || znak == EOF) {
      znak=getc(f1); //precteni enteru
      radek[poz]=0;
      if (znak == EOF && poz == 0) return(1);        //konec souboru
      break;
     }
    if (poz > 10000) { printf("Prilis dlouhy radek, zvetsi buffer."); exit(0); }
    else radek[poz]=znak;
   }
  if (radek[0] == '~') return(1);
  return(0);
 }

void PREVED_ATRIBUT(void) {
  if (strcmp(slovo,"1p") == 0) strcat(vystup,"1");        //pad
  if (strcmp(slovo,"2p") == 0) strcat(vystup,"2");
  if (strcmp(slovo,"3p") == 0) strcat(vystup,"3");
  if (strcmp(slovo,"4p") == 0) strcat(vystup,"4");
  if (strcmp(slovo,"5p") == 0) strcat(vystup,"5");
  if (strcmp(slovo,"6p") == 0) strcat(vystup,"6");
  if (strcmp(slovo,"7p") == 0) strcat(vystup,"7");

  if (strcmp(slovo,"0o") == 0) strcat(vystup,"n");        //osoba
  if (strcmp(slovo,"1o") == 0) strcat(vystup,"o");
  if (strcmp(slovo,"2o") == 0) strcat(vystup,"p");
  if (strcmp(slovo,"3o") == 0) strcat(vystup,"q");

  if (strcmp(slovo,"jc") == 0) strcat(vystup,"y");        //cislo
  if (strcmp(slovo,"mc") == 0) strcat(vystup,"Y");

  if (strcmp(slovo,"c1") == 0) strcat(vystup,"i");        //cas
  if (strcmp(slovo,"c2") == 0) strcat(vystup,"j");
  if (strcmp(slovo,"c3") == 0) strcat(vystup,"k");
  if (strcmp(slovo,"c4") == 0) strcat(vystup,"l");
  if (strcmp(slovo,"c5") == 0) strcat(vystup,"m");

  if (strcmp(slovo,"r1") == 0) strcat(vystup,"r");        //rod
  if (strcmp(slovo,"r2") == 0) strcat(vystup,"s");
  if (strcmp(slovo,"r3") == 0) strcat(vystup,"t");

  if (strcmp(slovo,"zA") == 0) strcat(vystup,"Z");        //zivotnost
  if (strcmp(slovo,"zN") == 0) strcat(vystup,"z");

  if (strcmp(slovo,"jC") == 0) strcat(vystup,"x");        //cislopredmetu
  if (strcmp(slovo,"mC") == 0) strcat(vystup,"X");

  if (strcmp(slovo,"R1") == 0) strcat(vystup,"a");        //rodpredmetu
  if (strcmp(slovo,"R2") == 0) strcat(vystup,"b");
  if (strcmp(slovo,"R3") == 0) strcat(vystup,"c");

  if (strcmp(slovo,"vN") == 0) strcat(vystup,"d");        //vid
  if (strcmp(slovo,"vD") == 0) strcat(vystup,"e");
                           // (neni zde "pouze predlozka" - neni to treba)

  if (strcmp(slovo,"T0") == 0) strcat(vystup,"A");        //tvar
  if (strcmp(slovo,"T1") == 0) strcat(vystup,"B");
  if (strcmp(slovo,"T2") == 0) strcat(vystup,"C");
  if (strcmp(slovo,"T3") == 0) strcat(vystup,"D");
  if (strcmp(slovo,"T4") == 0) strcat(vystup,"E");
  if (strcmp(slovo,"T5") == 0) strcat(vystup,"F");
  if (strcmp(slovo,"T6") == 0) strcat(vystup,"G");
  if (strcmp(slovo,"T7") == 0) strcat(vystup,"H");
  if (strcmp(slovo,"T8") == 0) strcat(vystup,"I");
  if (strcmp(slovo,"T9") == 0) strcat(vystup,"J");

  if (strcmp(slovo,"P0") == 0) strcat(vystup,"M");        //pridavek
  if (strcmp(slovo,"P1") == 0) strcat(vystup,"N");
  if (strcmp(slovo,"P2") == 0) strcat(vystup,"O");
  if (strcmp(slovo,"P3") == 0) strcat(vystup,"P");
  if (strcmp(slovo,"P4") == 0) strcat(vystup,"Q");
  if (strcmp(slovo,"P5") == 0) strcat(vystup,"R");
  if (strcmp(slovo,"P6") == 0) strcat(vystup,"S");
  if (strcmp(slovo,"P7") == 0) strcat(vystup,"T");
  if (strcmp(slovo,"P8") == 0) strcat(vystup,"U");
  if (strcmp(slovo,"P9") == 0) strcat(vystup,"V");

  if (strcmp(slovo,"nA") == 0) strcat(vystup,"W");        //zapor
  if (strcmp(slovo,"nN") == 0) strcat(vystup,"w");
 }

void ZAPIS_HLAVICKU(void) {
BYTE pocetzbytecnosti,pozzbyt;
  strcpy(hlavicka,"IQ Pokyd v0.15 - definice gramatiky a inteligence - Ales Janda (C) KYBLSoft 1999-2005");

  srand(time(NULL));
  pozice=strlen(hlavicka)+1;

  pocetzbytecnosti=rand()%100;
  hlavicka[pozice++]=pocetzbytecnosti^'I';
  for (pozzbyt=0; pozzbyt < pocetzbytecnosti; pozzbyt++)
   hlavicka[pozice++]=(char)rand();       //zbytecnosti (pro zmateni hackera)

  nahodnykodovaciklic=(char)rand();
  hlavicka[pozice++]=nahodnykodovaciklic;

  hlavicka[pozice++]=3;                   //signatura souboru s gramatikou (inteligenci)

  hlavicka[pozice++]=0;
   hlavicka[pozice++]=15;                  //verze IQ Pokydu 0.15

  hlavicka[pozice++]=0;                   //verze slovniku 0

  hlavicka[pozice++]=KODOVACI_ZNAK;       //hodnota KODOVACI_ZNAK

  delkahlavicky=pozice;

  fwrite(hlavicka,delkahlavicky+4,1,f2);
             //jeste 2 bajty na pocet podminek a 2 bajty na kontrolni soucty
 }

void main(void) {
WORD poziceslova,poziceidvprostoru;
BYTE hlavickovyradek;

  printf("\r"
         "  ----------------------------------------------------------------------------\n"
         "  |  Prevadec gramatiky (inteligence) IQ Pokydu z textove do binarni podoby  |\n"
         "  ----------------------------------------------------------------------------\n"
         "Copyright (C) Ales Janda - KYBLSoft 2005\n\n"
         "Prevadim...\n");

  if ((f1=fopen("gramatik.iqz","rb")) == NULL) {
    printf("\rNemuzu nalezt soubor \"gramatik.iqz\"!"); exit(0);
   }
  if ((f2=fopen("IQPOKYD.IQP","wb")) == NULL) {
    printf("\rNemuzu zapsat soubor \"IQPOKYD.IQP\"!"); exit(0);
   }

  ZAPIS_HLAVICKU();

  pocetpodminek=0;
  for (poziceradku=1; PRECTI_RADEK() == 0; poziceradku++) {
    vystupniradek[0]=0;
    switch(poziceradku%14) {
      case 1:                                      //hlavickovy radek
              hlavickovyradek=1; pocetpodminek++; pocetzavorek=0;
              strcpy(prostoridslov,"              ");       //vynulovani IDu slov
              break;
      case 10: case 0:                     //koncovy radek musi byt prazdny
              if (radek[0] != 0) {
                printf("Neprazdny radek %lu!",poziceradku); exit(0);
               }
              continue;
      case 11: case 12: case 13:        //real-time kecy zatim nepouzity
              continue;
      default: hlavickovyradek=0; break;
     }

    for (pozicenaradku=0; radek[pozicenaradku] != 0; pozicenaradku++) {
// *********************************************************************
      if (hlavickovyradek == 1) {
        if (radek[pozicenaradku] == '&') {
          if (radek[pozicenaradku+1] == '&') pozicenaradku++; //lze & i &&
         }
        if (radek[pozicenaradku] == '|') {
          if (radek[pozicenaradku+1] == '|') pozicenaradku++; //lze | i ||
         }
        if (radek[pozicenaradku] == ' ') continue;
        if (radek[pozicenaradku] == '#') {     //komentar, konec radku
          radek[pozicenaradku]=0; break;
         }
        if (radek[pozicenaradku] == 'S'
         || radek[pozicenaradku] == 'Z'
         || radek[pozicenaradku] == 'V') {
          PRIPOJ(vystupniradek,radek[pozicenaradku]);
          if (radek[++pozicenaradku] != '\"') {
            printf("Za 'S','Z' nebo 'V' musi nasledovat '\"' - radek %lu, pozice %u!",poziceradku,pozicenaradku+1); exit(0);
           }
          poziceslova=0; pozicenaradku++;
          do {
            if (poziceslova >= 60) {
              printf("Prilis dlouhe slovo v uvozovkach! Radek: %lu",poziceradku); exit(0);
             }
            slovo[poziceslova++]=radek[pozicenaradku++];
           } while (radek[pozicenaradku] != '\"');
          slovo[poziceslova]=0; UPRAV_SLOVO_PRO_IQPOKYD(slovo);
          poziceslova=strlen(slovo);   //kdyby se slovo zkratilo (ch -> '*')
          strcat(vystupniradek,slovo); PRIPOJ(vystupniradek,'\"');
          continue;
         }
        if (radek[pozicenaradku] == 'c'
         || radek[pozicenaradku] == 'e'
         || radek[pozicenaradku] == 'h'
         || radek[pozicenaradku] == 'o'
         || radek[pozicenaradku] == 'p'
         || radek[pozicenaradku] == 'u'
         || radek[pozicenaradku] == 'v'
         || radek[pozicenaradku] == 'x'
         || radek[pozicenaradku] == 'y') {
          PRIPOJ(vystupniradek,radek[pozicenaradku]); continue;
         }
        if (radek[pozicenaradku] == 'e') {
          if (pozicenaradku == 0) {  //pouze na zacatku, jako "jinak" ("else")
            PRIPOJ(vystupniradek,radek[pozicenaradku]); continue;
           }
         }
       }
// *********************************************************************
      if (radek[pozicenaradku] == '{') {
        if (radek[pozicenaradku+1] == '{') {
          if (hlavickovyradek != 1) { printf("100% vyznam (tvar {{vyznam}}) muze byt pouze v podmince (radek %lu)!",poziceradku); exit(0); }

          strcat(vystupniradek,"{"); pozicenaradku++;
         }                                   //muze zde byt slovo {{slovo}}

        switch(radek[++pozicenaradku]) {
          case '0': case '1': case '2': case '3': case '4':
          case '5': case '6': case '7': case '8': case '9':
            poziceidvprostoru=radek[pozicenaradku]-'0'; break;
          case 'P': poziceidvprostoru=11; break;         //podmet
          case 'R': poziceidvprostoru=12; break;         //prisudek
          case 'S': poziceidvprostoru=13; break;         //predmet
          default:
            printf("Za '{' musi byt cislo (ID) slova 0-9,P,S,T, napr. \"{1@1p-mc}\" (radek %lu)!",poziceradku); exit(0);
         }
        strcat(vystupniradek,"{");

        if (hlavickovyradek == 1) {     //podminka
          if (radek[pozicenaradku] != '0')  //nula je pro nepouzitelna slova
           prostoridslov[poziceidvprostoru]='x';   //obsazeni mista
         }
        else {               //odpoved
          if (radek[pozicenaradku] != '0')  //nula je pro nepouzitelna slova
           if (prostoridslov[poziceidvprostoru] != 'x') {
             printf("ID slova v odpovedi neni pouzito v podmince! Radek: %lu",poziceradku); exit(0);
            }
         }
        PRIPOJ(vystupniradek,radek[pozicenaradku]);

        pozicenaradku++;
        if (radek[pozicenaradku] == 'p' || radek[pozicenaradku] == 'c') {
          PRIPOJ(vystupniradek,radek[pozicenaradku]); pozicenaradku++;
         }
        if (radek[pozicenaradku] != '@') {
          printf("Za ID slova musi nasledovat znak '@','p' nebo 'c' - radek %lu!",poziceradku); exit(0);
         }
        PRIPOJ(vystupniradek,'@');

        pozicenaradku++;
        for (poziceslova=0; radek[pozicenaradku] != '>'; poziceslova++,pozicenaradku++) {
          if ((radek[pozicenaradku] >= '1' && radek[pozicenaradku] <= '9')
           || radek[pozicenaradku] == 'C' || radek[pozicenaradku] == 'E');
          else if (radek[pozicenaradku] == '?' && radek[pozicenaradku+1] == '>'
           && (poziceslova == 0 || hlavickovyradek == 1));
          else if (radek[pozicenaradku] == '\"') {
            do {
              if (poziceslova >= 60) {
                printf("Prilis dlouhe slovo v uvozovkach! Radek: %lu",poziceradku); exit(0);
               }
              slovo[poziceslova++]=radek[pozicenaradku++];
             } while (radek[pozicenaradku] != '\"');
                 //posledni uvozovky se zapisou na konci nadcyklu
            slovo[poziceslova]=0; UPRAV_SLOVO_PRO_IQPOKYD(slovo+1);
            poziceslova=strlen(slovo);   //kdyby se slovo zkratilo (ch -> '*')
           }
          else {
            printf("Neplatne vnoreni (nebo vnoreni uplne chybi)! Radek: %lu, pozice %u",poziceradku,pozicenaradku+1); exit(0);
           }
          if (poziceslova >= 20) {
            printf("Prilis dlouhe vnoreni! Radek: %lu",poziceradku);
           }
          slovo[poziceslova]=radek[pozicenaradku];
         }
        slovo[poziceslova]=0;
        strcat(vystupniradek,slovo); strcat(vystupniradek,">");
        if (radek[pozicenaradku+1] == '}') continue;  //jiz neobsahuje zadne atributy

        ZNOVAATRIBUT:
        vystup[0]=0; pozicenaradku++;
        for (poziceslova=0; radek[pozicenaradku] != '}' && radek[pozicenaradku] != '-'; poziceslova++,pozicenaradku++) {
          if (radek[pozicenaradku] == 0) { printf("Neplatne ukonceni '{' na radku %lu!",pozicenaradku); exit(0); }
          if (poziceslova >= 10) { printf("Neplatne slovo v '{}' na radku %lu!",radek); exit(0); }

          slovo[poziceslova]=radek[pozicenaradku];
         }
        slovo[poziceslova]=0;
        PREVED_ATRIBUT();

        if (vystup[0] == 0) {
          printf("Neplatny atribut \"%s\" na radku %lu!",slovo,poziceradku); exit(0);
         }
        strcat(vystupniradek,vystup);
        if (radek[pozicenaradku] == '-') goto ZNOVAATRIBUT;

        if (radek[pozicenaradku+1] == '}') {
          if (hlavickovyradek != 1) { printf("100% vyznam (tvar {{vyznam}}) muze byt pouze v podmince (radek %lu)!",poziceradku); exit(0); }

          strcat(vystupniradek,"}"); pozicenaradku++;
         }                                   //muze zde byt slovo {{slovo}}
        strcat(vystupniradek,"}");
       }
// *********************************************************************
      else if (radek[pozicenaradku] == '(' && hlavickovyradek == 1) {
        pocetzavorek++; PRIPOJ(vystupniradek,radek[pozicenaradku]);
       }
// *********************************************************************
      else if (radek[pozicenaradku] == ')' && hlavickovyradek == 1) {
        if (pocetzavorek == 0) {
            printf("Prilis pravych zavorek ')' na radku %lu, pozice %u!",poziceradku,pozicenaradku+1); exit(0);
          }
        pocetzavorek--;
        PRIPOJ(vystupniradek,radek[pozicenaradku]);
       }
// *********************************************************************
      else {
        if (hlavickovyradek == 1) {
          if (radek[pozicenaradku] == 'j'
           || radek[pozicenaradku] == 'n'
           || (radek[pozicenaradku] >= '0' && radek[pozicenaradku] <= '9')
           || radek[pozicenaradku] == '=' || radek[pozicenaradku] == '!'
           || radek[pozicenaradku] == '>' || radek[pozicenaradku] == '<'
           || radek[pozicenaradku] == '&' || radek[pozicenaradku] == '|');
          else {
            printf("Neznamy znak '%c' na radku %lu, pozice %u!",radek[pozicenaradku],poziceradku,pozicenaradku+1); exit(0);
           }
         }
        PRIPOJ(vystupniradek,radek[pozicenaradku]);
       }
     }

    if (hlavickovyradek == 1) {
      if (pocetzavorek > 0) {
        printf("Neuzavrene zavorky '()' na radku %lu!",poziceradku); exit(0);
       }
      strcat(vystupniradek,")"); //pridani na konec kvuli lepsimu cteni

      poziceradku++; PRECTI_RADEK();  //precteni dalsiho radku s hodnotou nalady
      if ((radek[0] != '+' && radek[0] != '-') ||
         radek[1] < '0' || radek[1] > '9') {
        printf("Neplatna hodnota nalady na radku %lu!",poziceradku); exit(0);
       }
      if (radek[0] == '+') PRIPOJ(vystupniradek,100+(radek[1]-'0'));
      else PRIPOJ(vystupniradek,100-(radek[1]-'0')); //hodnota nalady okolo 100
     }
    delkaradku=strlen(vystupniradek)+1;
    for (pozice=0; pozice < delkaradku; pozice++) {
      vystupniradek[pozice]+=KODOVACI_ZNAK;
      vystupniradek[pozice]^=KODOVACI_ZNAK;
                                            //toto se nepocita jako kodovani
      SPOCITEJ_KONTROLNI_SOUCET(vystupniradek[pozice]);
      vystupniradek[pozice]^=nahodnykodovaciklic;
      vystupniradek[pozice]-=(pozice^'K');
      vystupniradek[pozice]^='I';
      vystupniradek[pozice]+=nahodnykodovaciklic;
     }
    fwrite(vystupniradek,delkaradku,1,f2);
   }
  putc(kontrolnisoucet1,f2); putc(kontrolnisoucet2,f2);

  fclose(f1); fclose(f2);

  f2=fopen("IQPOKYD.IQP","rb+");
  fread(hlavicka,delkahlavicky,1,f2);

  hlavicka[delkahlavicky]=((char)(pocetpodminek>>8));
  hlavicka[delkahlavicky+1]=((char)pocetpodminek);

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

  znak=((char)(pocetpodminek>>8)); hlavicka[delkahlavicky]=(znak^'K')+nahodnykodovaciklic;
  znak=((char)pocetpodminek); hlavicka[delkahlavicky+1]=(znak^'K')+nahodnykodovaciklic;

  hlavicka[delkahlavicky+2]=kontrolnisoucet1;
  hlavicka[delkahlavicky+3]=kontrolnisoucet2;

  fseek(f2,0,SEEK_SET);
  fwrite(hlavicka,delkahlavicky+4,1,f2);

  fclose(f2);



  printf("Soubor uspesne preveden.\n");
 }
