import React from "react";

const pl = (n: number, forms: string) => {
  if (forms.indexOf("|") >= 0) {
    return forms.split("|")[n !== 1 ? 1 : 0];
  }
  if (forms.endsWith("y") && !"aeiouAEIOU".includes(forms.charAt(forms.length - 2))) {
    return n !== 1 ? forms.slice(0, -1) + "ies" : forms;
  }
  return forms + (n !== 1 ? "s" : "");
}

const plsi = (n: number, forms: string) => {
  const f = forms.split("|");
  const actN = Math.min(n % 100, 5);
  const i = Math.min(forms.length, [4, 1, 2, 3, 3, 4][actN]);
  return f[i - 1];
}

const dict: {[lang: string]: {[key: string]: any}} = {
  "en": {
    "loading": "Loading ...",
    "books": "Books",
    "collections": "Book Collections",
    "book.chapter": "Chapter",
    "book.chapters": "Chapters",
    "book.locked-chapter": "(Locked chapters)",
    "book.locked-chapter-msg-attempt": "The rest of the book will be unlocked when you attempt all shown questions",
    "book.locked-chapter-msg-correct": "The rest of the book will be unlocked when you correctly answer all shown questions",
    "book.next-in-collection": "Next book in this collection: ",
    "chapter.replay": "Replay",
    "chapter.showanswer": "Show Answer",
    "chapter.hideanswer": "Hide Answer",
    "chapter.showexplanation": "Show Explanation",
    "chapter.hideexplanation": "Hide Explanation",
    "quiz.fetch-answers-error": "Failed to fetch past answers to questions.",
    "quiz-progress.answered": "Answered",
    "quiz-progress.correct": "Correct",
    "quiz-progress.ungraded": "Ungraded",
    "quiz-progress.wrong": "Wrong",
    "quiz-progress.required": "Required",
    "quiz-progress.correct-single": "Your answer was correct.",
    "quiz-progress.wrong-single": "Your answer was incorrect.",
    "quiz-progress.no-answer-single": "You have not answered this question yet.",
    "quiz-progress.correct-wrong": (corr: number, wrong: number) =>
      `${corr} correct and ${wrong} wrong ${pl(wrong, "answer")}.`,
    "quiz-progress.correct-all": (n: number) => `${n} correct ${pl(n, "answer")}.`,
    "quiz-progress.wrong-all": (n: number) => `${n} incorrect ${pl(n, "answer")}.`,
    "quiz-progress.no-answers": "You have not answered any questions yet.",
    "quiz-progress.remaining": (n: number) => `\n${n} ${pl(n, "question")} remaining.`,
    "quiz.select-files": (n: number, multiple: boolean) => n === 0 ? `Select ${multiple ? "files" : "file"}`
                                                           : multiple ? "Select More Files" : "Select a different file",
    "quiz.upload-desc": (multiple: boolean) => `Select ${multiple ? "files" : "a file"} or drop ${multiple ? "them" : "it"} here.`,
    "quiz.uploaded-file": "You have uploaded",
    "quiz.not-logged-in": "You are not logged in; your answer cannot be saved.",
    "quiz.file-too-large": "All files must be smaller than 9.9 MB",
    "quiz.cant-upload-some-files": "Failed to upload some files. If this is not due to file size or your internet connection, please report the problem.",
    "quiz.cant-upload-file": "Failed to upload files. If this is not due to file size or your internet connection, please report the problem.",
    "quiz.cant-remove-file": "Failed to remove file. Please try again.",
    "quiz.invalid-group": "Invalid group for this book.",
    "quiz.upload-allowed-extensions": "Allowed file types:",
    "quiz.submit-button": "Submit",
    "quiz.submit-all-button": "Submit Answers",
    "quiz.dont-forget-to-submit-file": (n: number) => `${n === 1 ? "This file is" : "These files are"} not uploaded yet! Click Submit to upload ${n === 1 ? "it" : "them"}. After submission, you can no longer change ${n === 1 ? "it" : "them"}.`,
    "quiz.incorrect": "Your answer is incorrect.",
    "quiz.correct-answer": "Correct answer:",
    "quiz.attempts": "Allowed attempts",
    "quiz.remaining": "Remaining attempts",
    "quiz.correct": "Correct!",
    "quiz.points": "Points",
    "quiz.submission-error": "Your answer was not recorded. If this is not due to your internet connection, please report the problem.",
    "user.remove-data-fail": "Something went wrong. User data was not deleted.",
    "user.show-quiz-results": "Show Quiz Results",
    "user.anonymous-user": "Anonymous User",
    "user.show-answers": "Show Users' Answers",
    "user.back-to": "Back to",
    "user.change-group": "Change Group",
    "user.impersonate": "Impersonate User",
    "user.stop-impersonation": "Stop Impersonation",
    "user.log-out": "Log out",
    "user.delete-account": "Delete account",
    "user.delete-account-tooltip": "Delete your account and all related data",
    "user.reset-page": "Reset page",
    "user.reset-page-tooltip": "Remove question answers, group memberships and tokens.",
    "user.delete-account-confirm-title": "Delete user data",
    "user.delete-account-confirm-text": `
        This action is irreversible. Once confirmed, all account data will be
        permanently erased from our system. There is no way to recover this
        data after deletion. Please proceed only if you are certain.`,
    "login": "Login",
    "login.already-logged-in": (logOut: () => undefined) => <>
      <p>You are already logged in.</p>
      <p>To log in as a different user, please
        <a href="#" onClick={() => logOut()}>log out</a> first.</p>
    </>,
    "login.email-subject": `Your sign-in link for {title}`,
    "login.send-email-fail": "Failed to send the email. Please try again later.",
    "login.page-title": "Login to Notes",
    "login.contains-questions": "This book contains questions. You need to log in to save your answers.",
    "login.instructions": <>
        <p>Existing users can get a login link by email. New users must identify with an email and name
          (<a href="https://fri.uni-lj.si/en/privacy-policy">privacy policy</a>).
        </p>
        </>,
    "login.your-email-address": "Your email address",
    "login.existing-user-login": "Login as existing user",
    "login.unknown-email": "Unknown email address. Check your email or login as a new user.",
    "login.first-name": "First Name",
    "login.last-name": "Last Name",
    "login.requires-group": "This book is restricted to certain groups.",
    "login.requires-token": "This book requires a token.",
    "login.your-group": "Your group",
    "login.group-token": "Group token",
    "login.book-token": "Book token",
    "login.invalid-token": (askGroup: boolean) =>
      `Invalid token for ${askGroup ? "the selected group and" : ""} this book.`,
    "login.register-user": "Login as a new user",
    "login.proceed": "Start Reading",
    "login.email-sent": "Email has been sent. Please check your inbox.",
    "impersonate.not-admin": "Only admins can impersonate other users.",
    "results.download-as-excel": "Download all answers as Excel",
    "collection-results.download-as-excel": "Download scores as Excel",
    "results.download-as-zip": "Download a zip with results and all uploaded files",
    "results.no-answers": "No answers to display.",
    "results.group": "Group",
    "results.user-nr": "User #",
    "results.points": "Points",
  },
  "sl": {
    "loading": "Nalaganje ...",
    "books": "Knjige",
    "collections": "Zbirke knjig",
    "book.chapter": "Poglavje",
    "book.chapters": "Poglavja",
    "book.locked-chapter": "(Skrita poglavja)",
    "book.locked-chapter-msg-attempt": "Ostanek knjige bo prikazan, ko poskusite odgovoriti na vsa prikazana vprašanja",
    "book.locked-chapter-msg-correct": "Ostanek knjige bo prikazan, ko pravilno odgovorite na vsa prikazana vprašanja",
    "book.next-in-collection": "Naslednja knjiga v tej zbirki: ",
    "chapter.replay": "Pokaži ponovno",
    "chapter.showanswer": "Pokaži odgovor",
    "chapter.hideanswer": "Skrij odgovor",
    "chapter.showexplanation": "Pokaži razlago",
    "chapter.hideexplanation": "Skrij razlago",
    "quiz.fetch-answers-error": "Ni bilo mogoče pridobiti preteklih odgovorov na vprašanja.",
    "quiz-progress.answered": "Odgovorjeno",
    "quiz-progress.correct": "Pravilno",
    "quiz-progress.ungraded": "Ni ocenjeno",
    "quiz-progress.wrong": "Napačno",
    "quiz-progress.required": "Zahtevano",
    "quiz-progress.correct-single": "Vaš odgovor je pravilen.",
    "quiz-progress.wrong-single": "Vaš odgovor ni pravilen.",
    "quiz-progress.no-answer-single": "Na to vprašanje še niste odgovorili.",
    "quiz-progress.correct-wrong": (corr: number, wrong: number) =>
      `${plsi(corr, `En pravilen|Dva pravilna|${corr} pravilni|${corr} pravilnih`)} in ${plsi(wrong, `en napačen odgovor|dva napačna odgovora|${wrong} napačni odgovori|${wrong} napačnih odgovorov`)}.`,
    "quiz-progress.correct-all": (n: number) =>
      plsi(n, `En pravilen odgovor.|Dva pravilna odgovora.|${n} pravilni odgovori.|${n} pravilnih odgovorov.`),
    "quiz-progress.wrong-all": (n: number) =>
      plsi(n, `En napačen odgovor.|Dva napačna odgovora.|${n} napačni odgovori.|${n} napačnih odgovorov.`),
    "quiz-progress.no-answers": "Na vprašanja še niste odgovorjali.",
    "quiz-progress.remaining": (n: number) =>
      `\n${plsi(n, `Ostalo je še eno vprašanje|Ostali sta še dve vprašanji|Ostala so še ${n} vprašanja|Ostalo je še ${n} vprašanj`)}.`,
    "quiz.select-files": (n: number, multiple: boolean) => n === 0 ? `Izberi ${multiple ? "datoteke" : "datoteko"}`
                                                                  : multiple ? "Izberi dodatne datoteke" : "Izberi drugo datoteko",
    "quiz.upload-desc": (multiple: boolean) => `Izberite ${multiple ? "datoteke" : "datoteko"} za nalaganje ali ${multiple ? "jo" : "jih"} povlecite sem.`,
    "quiz.uploaded-file": "Naložili ste",
    "quiz.not-logged-in": "Niste prijavljeni; vaš odgovor ne more biti shranjen.",
    "quiz.file-too-large": "Vse datoteke morajo biti manjše od 9,9 MB",
    "quiz.cant-remove-file": "Ni bilo mogoče odstraniti datoteke. Prosim, poskusite znova.",
    "quiz.invalid-group": "Neveljavna skupina za to knjigo.",
    "quiz.upload-allowed-extensions": "Dovoljene vrste datotek:",
    "quiz.submit-button": "Oddaj",
    "quiz.submit-all-button": "Oddaj odgovore",
    "quiz.dont-forget-to-submit-file": (n: number) => `${n === 1 ? "Ta datoteka še ni naložena!" : n === 2 ? "Tidve datoteki še nista naloženi" : "Te datoteke še niso naložene!"} Kliknite Oddaj, da ${n === 1 ? "jo" : n === 2 ? "ju" : "jih"} naložite. Po oddaji ${n === 1 ? "je" : n === 2 ? "ju" : "jih"} ne boste več mogli spreminjati.`,
    "quiz.incorrect": "Odgovor ni pravilen.",
    "quiz.correct-answer": "Pravilen odgovor:",
    "quiz.attempts": "Možnih poskusov",
    "quiz.remaining": "Preostalih poskusov",
    "quiz.correct": "Pravilno!",
    "quiz.points": "Število točk",
    "quiz.submission-error": "Odgovor ni bil zabeležen. Če težava ni v vaši internetni povezavi, vas prosimo, da nas obvestite o napaki.",
    "quiz.cant-upload-some-files": "Nalaganje nekaterih datotek ni uspelo. Če težava ni v velikosti ali vaši internetni povezavi, nam sporočite.",
    "quiz.cant-upload-file": "Nalaganje ni uspelo. Če težava ni v velikosti ali vaši internetni povezavi, nam sporočite.",
    "user.remove-data-fail": "Nekaj je šlo narobe. Podatki uporabnika niso bili izbrisani.",
    "user.anonymous-user": "Anonimni uporabnik",
    "user.show-quiz-results": "Prikaži rezultate kviza",
    "user.show-answers": "Prikaži odgovore uporabnikov",
    "user.back-to": "Nazaj na",
    "user.change-group": "Spremeni skupino",
    "user.impersonate": "Prevzemi identiteto uporabnika",
    "user.stop-impersonation": "Ustavi prevzemanje",
    "user.log-out": "Odjava",
    "user.delete-account-tooltip": "Izbriši svoj račun in vse povezane podatke",
    "user.delete-account": "Izbriši račun",
    "user.reset-page": "Ponastavi stran",
    "user.reset-page-tooltip": "Odstrani odgovore na vprašanja, članstva v skupinah in žetone.",
    "user.delete-account-confirm-title": "Izbriši uporabniške podatke",
    "user.delete-account-confirm-text": `
        Ta dejanje je nepovratno. Ko bo potrjeno, bodo vsi podatki računa
        trajno izbrisani iz našega sistema. Po izbrisu ni mogoče obnoviti
        teh podatkov. Nadaljujte le, če ste prepričani.`,
    "login": "Prijava",
    "login.already-logged-in": (logOut: () => undefined) => <>
      <p>Ste že prijavljeni.</p>
      <p>
        Če se želite prijaviti kot drug uporabnik, se najprej{" "}
        <a href="#" onClick={() => logOut()}>odjavite</a>.
      </p>
    </>,
    "login.email-subject": `Povezava za prijavo v {title}`,
    "login.send-email-fail": "Pošiljanje e-pošte ni uspelo. Poskusite znova pozneje.",
    "login.page-title": "Prijava v Notes",
    "login.contains-questions": "Ta knjiga vsebuje vprašanja. Da bodo vaši odgovori shranjeni po vašim imenom, se morate prijaviti.",
    "login.instructions":
      <>
        <p>Obstoječi uporabniki lahko pridobijo povezavo za prijavo po e-pošti.
          Novi uporabniki se morajo identificirati z e-pošto in imenom (<a href="https://fri.uni-lj.si/sl/politika-zasebnosti">politika zasebnosti</a>).
        </p>
      </>,
    "login.your-email-address": "Vaš e-poštni naslov",
    "login.existing-user-login": "Prijava kot obstoječi uporabnik",
    "login.unknown-email": "Neznan e-poštni naslov. Preverite svoj e-poštni naslov ali se prijavite kot nov uporabnik.",
    "login.first-name": "Ime",
    "login.last-name": "Priimek",
    "login.requires-group": "Ta knjiga je omejena na določene skupine.",
    "login.requires-token": "Za to knjigo je potreben žeton.",
    "login.your-group": "Vaša skupina",
    "login.group-token": "Žeton skupine",
    "login.book-token": "Žeton",
    "login.invalid-token": (askGroup: boolean) =>
      `Neveljaven žeton za ${askGroup ? "izbrano skupino in" : ""} to knjigo.`,
    "login.register-user": "Prijava kot nov uporabnik",
    "login.proceed": "Začnite z branjem",
    "login.email-sent": "Sporočilo je poslano. Prosimo, preverite svoj poštni predal.",
    "impersonate.not-admin": "Samo skrbniki lahko prevzamejo identiteto drugih uporabnikov.",
    "results.download-as-excel": "Prenesi vse odgovore kot Excelovo preglednico",
    "collection-results.download-as-excel": "Prenesi rezultate kot Excelovo preglednico",
    "results.download-as-zip": "Prenesi zip z rezultati in vsemi naloženimi datotekami",
    "results.no-answers": "Ni odgovorov za prikaz.",
    "results.group": "Skupina",
    "results.user-nr": "Uporabnik #",
    "results.points": "Točke",

    "text-replacements": {
      "/(\\s)\"/": "$1»",
      "/(\\S)\"/": "$1«"
    }
  }
};



/* Move this out of the way */

dict["en"]["login.email-plain"] = `Hello,

Use the link below to sign in to {title}:

{url}

This link will expire in 30 minutes. If you didn’t request this email, you can safely ignore it.

– The Notes Team`;

dict["en"]["login.email-html"] = `
    <p>Hello,</p>
    <p>Use the button below to sign in to <strong>{title}</strong>:</p>
    <p><a href="{url}" style="
      display:inline-block;
      padding:10px 20px;
      background-color:#2563eb;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
    ">Sign in</a></p>
    <p>This link will expire in 30 minutes. If you didn’t request this email, you can safely ignore it.</p>
    <p>– The Notes Team</p>`;


dict["sl"]["login.email-plain"] = `Pozdravljeni,

Uporabite spodnjo povezavo za prijavo v {title}:

{url}

Povezava bo veljavna 30 minut. Če niste zahtevali tega e-poštnega sporočila, ga lahko varno prezrete.

– Ekipa Notes`;

dict["sl"]["login.email-html"] = `
    <p>Pozdravljeni,</p>
    <p>Uporabite spodnji gumb za prijavo v <strong>{title}</strong>:</p>
    <p><a href="{url}" style="
      display:inline-block;
      padding:10px 20px;
      background-color:#2563eb;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
    ">Prijava</a></p>
    <p>Povezava bo veljavna 30 minut. Če niste zahtevali tega e-poštnega sporočila, ga lahko varno prezrete.</p>
    <p>– Ekipa Notes</p>`;


export default dict;
