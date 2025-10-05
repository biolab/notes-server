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
    "quiz.select-file": "Select File",
    "quiz.select-files": "Select Files",
    "quiz.upload-single-desc": "Select a file to upload, or drag and drop it here.",
    "quiz.upload-multiple-desc": "Select files to upload, or drag and drop them here.",
    "quiz.upload-staged": "Staged for upload:",
    "quiz.uploaded-file": "You have uploaded",
    "quiz.upload-button": "Upload Files",
    "quiz.upload-replace-button": "Upload Files & Replace Existing",
    "quiz.not-logged-in": "You are not logged in; your answer cannot be saved.",
    "quiz.file-too-large": "Total file size must not exceed 50 MB",
    "quiz.upload-allowed-extensions": "Allowed file types:",
    "quiz.submit-button": "Submit",
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
    "login.email-subject": "Your sign-in link for Notes",
    "login.send-email-fail": "Failed to send the email. Please try again later.",
    "login.page-title": "Login to Notes",
    "login.contains-questions": "This book contains questions. You need to log in to save your answers.",
    "login.instructions": "Existing users can get a login link by email. New users must identify with an email and name.",
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
  },
  "sl": {
    "loading": "Nalaganje ...",
    "books": "Knjige",
    "collections": "Zbirke knjig",
    "book.chapter": "Poglavje",
    "book.chapters": "Poglavja",
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
    "quiz.select-file": "Izberi datoteko",
    "quiz.select-files": "Izberi datoteke",
    "quiz.upload-single-desc": "Izberite datoteko za nalaganje ali jo povlecite in spustite sem.",
    "quiz.upload-multiple-desc": "Izberite datoteke za nalaganje ali jih povlecite in spustite sem.",
    "quiz.upload-staged": "Pripravljeno za nalaganje:",
    "quiz.uploaded-file": "Naložili ste",
    "quiz.upload-button": "Naloži datoteke",
    "quiz.upload-replace-button": "Naloži datoteke in zamenjaj obstoječe",
    "quiz.not-logged-in": "Niste prijavljeni; vaš odgovor ne more biti shranjen.",
    "quiz.file-too-large": "Skupna velikost datotek ne sme presegati 50 MB",
    "quiz.upload-allowed-extensions": "Dovoljene vrste datotek:",
    "quiz.submit-button": "Oddaj",
    "quiz.incorrect": "Odgovor ni pravilen.",
    "quiz.correct-answer": "Pravilen odgovor:",
    "quiz.attempts": "Možnih poskusov",
    "quiz.remaining": "Preostalih poskusov",
    "quiz.correct": "Pravilno!",
    "quiz.points": "Število točk",
    "quiz.submission-error": "Odgovor ni bil zabeležen. Če težava ni v vaši internetni povezavi, vas prosimo, da nas obvestite o napaki.",
    "user.remove-data-fail": "Nekaj je šlo narobe. Podatki uporabnika niso bili izbrisani.",
    "user.anonymous-user": "Anonimni uporabnik",
    "user.show-quiz-results": "Prikaži rezultate kviza",
    "user.show-answers": "Prikaži odgovore uporabnikov",
    "user.back-to": "Nazaj na",
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
    "login.email-subject": "Povezava za prijavo v Notes",
    "login.send-email-fail": "Pošiljanje e-pošte ni uspelo. Poskusite znova pozneje.",
    "login.page-title": "Prijava v Notes",
    "login.contains-questions": "Ta knjiga vsebuje vprašanja. Za shranjevanje svojih odgovorov se morate prijaviti.",
    "login.instructions": "Obstoječi uporabniki lahko pridobijo povezavo za prijavo po e-pošti. Novi uporabniki se morajo identificirati z e-pošto in imenom.",
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

    "text-replacements": {
      "/(\\s)\"/": "$1»",
      "/(\\S)\"/": "$1«"
    }
  }
};



/* Move this out of the way */

dict["en"]["login.email-plain"] = (url: string) => `Hello,

Use the link below to sign in to Notes:

${url}

This link will expire in 30 minutes. If you didn’t request this email, you can safely ignore it.

– The Notes Team`;

dict["en"]["login.email-html"] = (url: string) => `
    <p>Hello,</p>
    <p>Use the button below to sign in to <strong>Notes</strong>:</p>
    <p><a href="${url}" style="
      display:inline-block;
      padding:10px 20px;
      background-color:#2563eb;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
    ">Sign in</a></p>
    <p>This link will expire in 30 minutes. If you didn’t request this email, you can safely ignore it.</p>
    <p>– The Notes Team</p>`;


dict["sl"]["login.email-plain"] = (url: string) => `Pozdravljeni,

Uporabite spodnjo povezavo za prijavo v Notes:

${url}

Povezava bo veljavna 30 minut. Če niste zahtevali tega e-poštnega sporočila, ga lahko varno prezrete.

– Ekipa Notes`;

dict["sl"]["login.email-html"] = (url: string) => `
    <p>Pozdravljeni,</p>
    <p>Uporabite spodnji gumb za prijavo v <strong>Notes</strong>:</p>
    <p><a href="${url}" style="
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
