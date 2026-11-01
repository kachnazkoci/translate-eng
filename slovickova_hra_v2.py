import random, re, tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
from openpyxl import load_workbook

HERE=Path(__file__).resolve().parent
BOOK=HERE/"slovicka.xlsx"
BG="#F3F5FA"; WHITE="#FFFFFF"; TEXT="#20283A"; MUTED="#687386"; BLUE="#4968D5"; GREEN="#16834A"; RED="#C0392B"

def norm(s):
    s=str(s or "").strip().casefold()
    s=re.sub(r"[.,!?;:'\"()]", "", s)
    return re.sub(r"\s+"," ",s).strip()

def read_words():
    wb=load_workbook(BOOK,read_only=True,data_only=True)
    ws=wb["Slovník"]
    heads=[c.value for c in ws[1]]
    ix={h:i for i,h in enumerate(heads)}
    result=[]; used=set()
    for row in ws.iter_rows(min_row=2,values_only=True):
        try: ident=int(row[ix["ID"]])
        except: continue
        en=str(row[ix["Anglický výraz (základní tvar)"]] or "").strip()
        cz=str(row[ix["Český překlad"]] or "").strip()
        if not en or not cz or ident in used: continue
        used.add(ident)
        result.append({"id":ident,"en":en,"cz":cz,"cat":str(row[ix["Kategorie"]] or "introduction")})
    wb.close()
    return result

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Angličtina – slovíčková hra"); self.geometry("880x650"); self.minsize(730,560); self.configure(bg=BG)
        self.words=[]; self.score=0
        self.header=tk.Frame(self,bg=BG); self.header.pack(fill="x",padx=28,pady=(20,4))
        tk.Label(self.header,text="ENGLISH  /  CZECH",bg=BG,fg=BLUE,font=("Segoe UI",10,"bold")).pack(anchor="w")
        tk.Label(self.header,text="Slovíčková hra",bg=BG,fg=TEXT,font=("Segoe UI",25,"bold")).pack(anchor="w")
        self.status=tk.Label(self,text="",bg=BG,fg=MUTED,font=("Segoe UI",10)); self.status.pack(anchor="w",padx=30)
        self.body=tk.Frame(self,bg=BG); self.body.pack(fill="both",expand=True,padx=28,pady=12)
        tk.Label(self,text="Zdroj slovíček: slovicka.xlsx",bg=BG,fg=MUTED,font=("Segoe UI",9)).pack(anchor="w",padx=30,pady=8)
        self.home()

    def clear(self):
        for w in self.body.winfo_children(): w.destroy()

    def load(self):
        try: self.words=read_words()
        except Exception as e:
            self.words=[]; messagebox.showerror("Chyba Excelu",f"Nepodařilo se načíst slovicka.xlsx.\n\n{e}")

    def btn(self,parent,text,cmd,primary=False):
        return tk.Button(parent,text=text,command=cmd,bg=BLUE if primary else "#E8ECF8",fg="white" if primary else TEXT,
            activebackground="#3653B8",activeforeground="white",relief="flat",bd=0,cursor="hand2",
            font=("Segoe UI",10,"bold"),padx=16,pady=10)

    def panel(self):
        f=tk.Frame(self.body,bg=WHITE,highlightthickness=1,highlightbackground="#E2E6EF")
        f.pack(fill="both",expand=True,pady=8); return f

    def home(self):
        self.load(); self.clear(); self.status.config(text=f"Ve slovníku je {len(self.words)} výrazů")
        p=self.panel()
        tk.Label(p,text="Vyber si způsob procvičování",bg=WHITE,fg=TEXT,font=("Segoe UI",16,"bold")).pack(anchor="w",padx=22,pady=(20,8))
        tk.Label(p,text="Pět dvojic na rozehřátí, nebo dvacet překladů naostro.",bg=WHITE,fg=MUTED,font=("Segoe UI",10)).pack(anchor="w",padx=22,pady=(0,16))
        row=tk.Frame(p,bg=WHITE); row.pack(anchor="w",padx=22)
        self.btn(row,"1  Přiřazování · 5 dvojic",self.match,True).pack(side="left",padx=(0,10))
        self.btn(row,"2  Překlad · 20 slov",self.translate).pack(side="left")
        cats=sorted(set(w["cat"] for w in self.words),key=lambda x:(x!="introduction",x))
        f=tk.Frame(p,bg=WHITE); f.pack(anchor="w",padx=22,pady=25)
        tk.Label(f,text="Procvičovat kategorii:",bg=WHITE,fg=TEXT,font=("Segoe UI",10,"bold")).pack(anchor="w")
        self.cat=tk.StringVar(value="Všechny kategorie")
        ttk.Combobox(f,textvariable=self.cat,state="readonly",width=27,values=["Všechny kategorie"]+cats).pack(anchor="w",pady=7)
        self.btn(p,"Znovu načíst Excel",self.home).pack(anchor="w",padx=22,pady=(0,20))

    def pool(self):
        c=self.cat.get()
        return self.words if c=="Všechny kategorie" else [w for w in self.words if w["cat"]==c]

    def match(self):
        self.pool_words=self.pool()
        if len(self.pool_words)<5:
            messagebox.showinfo("Málo slovíček","Pro tuto hru potřebuješ alespoň 5 výrazů ve vybrané kategorii."); return
        # Jedno herní kolo má nejvýše 20 různých slovíček.
        # Při menší kategorii se použijí všechna dostupná slovíčka.
        self.match_session = random.sample(self.pool_words, min(20, len(self.pool_words)))
        self.match_round_index = 0
        self.points = 0
        self.match_round()

    def match_round(self):
        start = self.match_round_index * 5
        self.pairs = self.match_session[start:start + 5]
        if not self.pairs:
            self.match_result()
            return
        self.clear(); self.done=set(); self.selected=None
        self.status.config(text=f"Přiřazování  •  Kolo {self.match_round_index + 1}/{(len(self.match_session) + 4)//5}  •  Body: {self.points}/{len(self.match_session)}")
        p=self.panel()
        tk.Label(p,text="Spoj anglické výrazy s českými překlady",bg=WHITE,fg=TEXT,font=("Segoe UI",15,"bold")).pack(anchor="w",padx=20,pady=(18,4))
        tk.Label(p,text="Klikni na anglický výraz a potom na odpovídající český překlad.",bg=WHITE,fg=MUTED).pack(anchor="w",padx=20,pady=(0,12))
        cols=tk.Frame(p,bg=WHITE); cols.pack(fill="both",expand=True,padx=20)
        left=tk.Frame(cols,bg=WHITE); right=tk.Frame(cols,bg=WHITE); left.pack(side="left",fill="both",expand=True,padx=(0,8)); right.pack(side="left",fill="both",expand=True,padx=(8,0))
        tk.Label(left,text="ENGLISH",bg=WHITE,fg=BLUE,font=("Segoe UI",9,"bold")).pack(anchor="w")
        tk.Label(right,text="ČESKY",bg=WHITE,fg=BLUE,font=("Segoe UI",9,"bold")).pack(anchor="w")
        self.mb={}
        for w in self.pairs:
            b=self.btn(left,w["en"],lambda x=w:self.pick_en(x)); b.pack(fill="x",pady=4); self.mb[("e",w["id"])]=b
        for w in random.sample(self.pairs,len(self.pairs)):
            b=self.btn(right,w["cz"],lambda x=w:self.pick_cz(x)); b.pack(fill="x",pady=4); self.mb[("c",w["id"])]=b
        self.msg=tk.Label(p,text="",bg=WHITE,fg=MUTED,font=("Segoe UI",10)); self.msg.pack(pady=10)
        bottom=tk.Frame(p,bg=WHITE); bottom.pack(fill="x",padx=20,pady=(0,18))
        self.btn(bottom,"Domů",self.home).pack(side="left")
        next_label = "Vyhodnotit hru" if start + len(self.pairs) >= len(self.match_session) else "Další pětice"
        self.btn(bottom,next_label,self.advance_match,True).pack(side="right")

    def pick_en(self,w):
        if w["id"] in self.done:return
        self.selected=w; self.msg.config(text=f"Vybráno: {w['en']} — vyber český překlad.",fg=BLUE)
        for (side,i),b in self.mb.items():
            if side=="e": b.config(bg="#C9D5FA" if i==w["id"] else "#E8ECF8")

    def pick_cz(self,w):
        if not self.selected:
            self.msg.config(text="Nejprve vyber anglický výraz.",fg=RED); return
        x=self.selected; self.selected=None
        if x["id"]==w["id"]:
            self.done.add(x["id"]); self.points+=1
            self.mb[("e",x["id"])].config(state="disabled",bg="#DDF3E6",fg=GREEN)
            self.mb[("c",w["id"])].config(state="disabled",bg="#DDF3E6",fg=GREEN)
            self.msg.config(text=f"Správně! {len(self.done)}/5 dvojic.",fg=GREEN)
        else:self.msg.config(text="To není správná dvojice. Zkus to znovu.",fg=RED)
        self.status.config(text=f"Přiřazování  •  Kolo {self.match_round_index + 1}/{(len(self.match_session) + 4)//5}  •  Body: {self.points}/{len(self.match_session)}")
        if len(self.done)==len(self.pairs):
            self.msg.config(text="Skvěle! Všechna slova v této pětici máš správně. Pokračuj dál.",fg=GREEN)

    def advance_match(self):
        if len(self.done) != len(self.pairs):
            messagebox.showinfo("Ještě pokračuj", "Nejdříve správně přiřaď všech pět dvojic.")
            return
        self.match_round_index += 1
        if self.match_round_index * 5 >= len(self.match_session):
            self.match_result()
        else:
            self.match_round()

    def match_result(self):
        self.clear()
        total = len(self.match_session)
        self.status.config(text="Přiřazování dokončeno")
        p = self.panel()
        tk.Label(p,text="Hotovo!",bg=WHITE,fg=TEXT,font=("Segoe UI",24,"bold")).pack(pady=(30,8))
        tk.Label(p,text=f"Získala jsi {self.points} z {total} bodů",bg=WHITE,fg=BLUE,font=("Segoe UI",19,"bold")).pack(pady=10)
        percent = round(self.points / total * 100) if total else 0
        tk.Label(p,text=f"Úspěšnost: {percent} %",bg=WHITE,fg=MUTED,font=("Segoe UI",11)).pack(pady=5)
        tk.Label(p,text="V tomto kole se žádné slovíčko neopakovalo.",bg=WHITE,fg=MUTED,font=("Segoe UI",10)).pack(pady=(4,18))
        self.btn(p,"Nová hra",self.match,True).pack(pady=6)
        self.btn(p,"Zpět na hlavní nabídku",self.home).pack(pady=6)

    def translate(self):
        self.items=self.pool()
        if not self.items:
            messagebox.showinfo("Prázdná kategorie","V této kategorii zatím nejsou žádná slovíčka."); return
        self.items=random.sample(self.items,min(20,len(self.items))); self.n=0; self.points=0; self.ask()

    def ask(self):
        self.clear(); self.current=self.items[self.n]; self.direction=random.choice(["ec","ce"])
        self.status.config(text=f"Přímý překlad  •  {self.n+1}/{len(self.items)}  •  Body: {self.points}")
        p=self.panel()
        tk.Label(p,text="Přelož výraz",bg=WHITE,fg=MUTED,font=("Segoe UI",11)).pack(pady=(28,8))
        tk.Label(p,text="Angličtina → čeština" if self.direction=="ec" else "Čeština → angličtina",bg=WHITE,fg=BLUE,font=("Segoe UI",10,"bold")).pack()
        prompt=self.current["en"] if self.direction=="ec" else self.current["cz"]
        tk.Label(p,text=prompt,bg=WHITE,fg=TEXT,font=("Segoe UI",22,"bold"),wraplength=700,justify="center").pack(padx=24,pady=22)
        self.answer=tk.StringVar()
        self.entry=tk.Entry(p,textvariable=self.answer,font=("Segoe UI",14),justify="center",relief="solid",bd=1)
        self.entry.pack(fill="x",padx=90,ipady=9); self.entry.bind("<Return>",lambda e:self.check())
        self.feedback=tk.Label(p,text="",bg=WHITE,fg=MUTED,font=("Segoe UI",11),wraplength=700); self.feedback.pack(pady=18)
        actions=tk.Frame(p,bg=WHITE); actions.pack(pady=(0,20))
        self.checkbtn=self.btn(actions,"Vyhodnotit",self.check,True); self.checkbtn.pack(side="left",padx=5)
        self.nextbtn=self.btn(actions,"Další otázka",self.next); self.nextbtn.pack(side="left",padx=5); self.nextbtn.config(state="disabled")
        self.btn(p,"Domů",self.home).pack(pady=(0,16)); self.entry.focus_set()

    def check(self):
        if self.checkbtn["state"]=="disabled":return
        ans=norm(self.answer.get())
        if not ans:self.feedback.config(text="Napiš nejdříve svůj překlad.",fg=RED);return
        accepted=[norm(x) for x in (self.current["cz"].split(";") if self.direction=="ec" else [self.current["en"]])]
        if ans in accepted:
            self.points+=1; self.feedback.config(text="Správně! ✓",fg=GREEN)
        else:
            sol=self.current["cz"] if self.direction=="ec" else self.current["en"]
            self.feedback.config(text=f"Správná odpověď: {sol}",fg=RED)
        self.checkbtn.config(state="disabled"); self.nextbtn.config(state="normal")
        self.status.config(text=f"Přímý překlad  •  {self.n+1}/{len(self.items)}  •  Body: {self.points}")

    def next(self):
        self.n+=1
        if self.n>=len(self.items):
            self.clear(); self.status.config(text="Procvičování dokončeno")
            p=self.panel()
            tk.Label(p,text="Hotovo!",bg=WHITE,fg=TEXT,font=("Segoe UI",24,"bold")).pack(pady=(30,8))
            tk.Label(p,text=f"Získala jsi {self.points} z {len(self.items)} bodů.",bg=WHITE,fg=BLUE,font=("Segoe UI",18,"bold")).pack(pady=10)
            self.btn(p,"Zkusit znovu",self.translate,True).pack(pady=8)
            self.btn(p,"Zpět na hlavní nabídku",self.home).pack(pady=8)
        else:self.ask()

if __name__=="__main__":
    App().mainloop()
