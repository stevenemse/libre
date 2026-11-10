-- Libre — bibliothèque de conseils (40 fiches, contexte CEMAC/UEMOA)
-- Contenu géré en base : modifiable sans redéploiement.

create unique index if not exists tips_title_locale_idx on public.tips (title, locale);

insert into public.tips (category, level, title, body, locale) values
-- Épargner
('Épargner', 'Débutant', 'Épargne = revenus − besoins', 'Ton épargne n''est pas ce qui reste à la fin du mois : c''est ce que tu mets de côté avant de dépenser. Sépare dès la paie : besoins d''abord, épargne ensuite, envies avec le reste. Même 2 000 FCFA comptent. Ce qui compte, c''est la répétition, pas le montant.', 'fr'),
('Épargner', 'Débutant', 'Paie reçue, épargne partie', 'Le jour où l''argent arrive, mets de côté ta part avant tout le reste. Un virement automatique vers un compte ou un porte-monnaie Mobile Money séparé évite la tentation. Ce que tu ne vois pas, tu ne le dépenses pas.', 'fr'),
('Épargner', 'Débutant', 'Le premier 10 %', 'Si tu n''épargnes rien aujourd''hui, vise 10 % de tes revenus. Sur 100 000 FCFA, c''est 10 000. Ce n''est pas spectaculaire, mais c''est un début qui change ta relation à l''argent. Augmente d''un point chaque mois.', 'fr'),
('Épargner', 'Débutant', 'Un besoin, une envie', 'Avant chaque dépense, demande-toi : est-ce que je dois ou est-ce que je veux ? Le loyer est un besoin, la sortie est une envie. Nommer les choses t''aide à voir où part ton argent sans te juger.', 'fr'),
('Épargner', 'Intermédiaire', 'La règle des 24 heures', 'Pour tout achat non prévu au-dessus d''un montant que tu choisis, attends 24 heures. La plupart des envies disparaissent. Celles qui restent sont souvent de vrais besoins, et tu les achètes sans regret.', 'fr'),
('Épargner', 'Intermédiaire', 'Ton taux d''épargne, pas ton montant', 'Comparer les montants ne veut rien dire : 20 000 FCFA sur 80 000, c''est mieux que 50 000 sur 500 000. Regarde ton taux : épargne ÷ revenus. C''est le seul chiffre qui compte.', 'fr'),
('Épargner', 'Intermédiaire', 'Les petits débits qui pèsent', 'Crédit téléphone, abonnements, snacks quotidiens : additionne-les sur un mois. Une dépense de 1 000 FCFA par jour, c''est 30 000 FCFA par mois, 360 000 par an. Tu ne les supprimes pas forcément, tu les choisis en connaissance de cause.', 'fr'),
('Épargner', 'Intermédiaire', 'Épargne Mobile Money séparée', 'Garde ton épargne sur un compte ou un portefeuille distinct de ton argent du quotidien. Si tout est au même endroit, tu pioches sans t''en rendre compte. Un espace séparé, c''est une frontière.', 'fr'),
('Épargner', 'Avancé', 'Épargne de précaution avant tout', 'Avant d''investir, constitue 3 mois de besoins de côté. Sans coussin, un imprévu te force à vendre ou à emprunter au pire moment. La protection vient avant le rendement.', 'fr'),
('Épargner', 'Avancé', 'Automatise ce qui est régulier', 'Loyer, électricité, école, tontine : tout ce qui revient chaque mois mérite une date et un montant prévus. Ce qui est planifié ne devient plus une surprise. Il ne reste que le variable à gérer.', 'fr'),
-- Investir
('Investir', 'Débutant', 'Trois directions pour ton argent', 'Ton épargne peut aller vers trois poches : les biens de subsistance (ce qui sert), les assets (ce qui rapporte) et la protection (ce qui te sécurise). Un budget sain touche aux trois.', 'fr'),
('Investir', 'Débutant', 'Un asset, c''est quoi ?', 'Un asset produit quelque chose : un commerce qui vend, un local loué, une compétence qui se monétise, une part d''entreprise. S''il ne rapporte rien et ne prend pas de valeur, ce n''est pas un asset, c''est une dépense.', 'fr'),
('Investir', 'Débutant', 'La tontine comme école', 'Une tontine t''apprend la discipline et la confiance. Mais elle ne produit pas de rendement par elle-même : elle organise ton épargne. Garde-la pour la rigueur, pas comme placement.', 'fr'),
('Investir', 'Intermédiaire', 'Ton premier petit commerce', 'Commence petit : achète ce que tu peux écouler en une semaine, mesure ta marge, réinvestis. Le but des trois premiers mois n''est pas de gagner beaucoup, c''est de comprendre tes chiffres.', 'fr'),
('Investir', 'Intermédiaire', 'Calcule avant d''investir', 'Pour chaque projet, note : mise de départ, revenu mensuel attendu, charges, délai pour récupérer la mise. Si le délai dépasse deux ans sans certitude, tu prends beaucoup de risque.', 'fr'),
('Investir', 'Intermédiaire', 'Le rendement n''est pas promis', 'Un rendement de 10 % est une hypothèse, pas une garantie. Les simulations de Libre sont indicatives. Investis seulement ce que tu peux perdre sans mettre en danger tes besoins.', 'fr'),
('Investir', 'Intermédiaire', 'Diversifie sans te disperser', 'Mettre tout dans une seule activité, c''est simple mais fragile. Deux ou trois sources différentes suffisent au début. L''objectif est de ne pas tout perdre si l''une s''arrête.', 'fr'),
('Investir', 'Avancé', 'La règle des 4 %', 'Un capital qui couvre tes besoins annuels divisé par 0,04 te donne ta liberté financière. Si tes besoins sont 100 000 FCFA par mois, ta cible est 30 millions. C''est loin, mais c''est un cap chiffré.', 'fr'),
('Investir', 'Avancé', 'Réinvestis d''abord', 'Les premiers revenus d''un asset ne servent pas à consommer : ils servent à le faire grandir. Attends que l''asset couvre tes besoins avant d''en profiter. La patience composée paie plus que l''impatience.', 'fr'),
('Investir', 'Avancé', 'Le coût d''un crédit', 'Un crédit à 5 % par mois coûte plus cher que la plupart des rendements. Avant d''emprunter pour investir, compare le taux du crédit au rendement réel de ton projet. Si le second est incertain, refuse.', 'fr'),
-- Protéger
('Protéger', 'Débutant', 'Trois mois de tranquillité', 'Un fonds d''urgence de 3 mois de besoins te protège des imprévus : santé, panne, perte de revenu. Ce n''est pas de l''argent perdu, c''est de l''argent qui t''évite de t''endetter.', 'fr'),
('Protéger', 'Débutant', 'Assurance santé d''abord', 'Une hospitalisation peut effacer des années d''épargne. Une couverture santé, même modeste, est souvent le meilleur investissement de départ. Vérifie ce qu''elle couvre réellement avant de payer.', 'fr'),
('Protéger', 'Débutant', 'Garde tes papiers en double', 'Copie tes documents importants (carte d''identité, contrats, reçus) et range-les ailleurs que chez toi, chez un proche de confiance ou en ligne. En cas de perte, tu gagnes des semaines.', 'fr'),
('Protéger', 'Intermédiaire', 'Plusieurs sources de revenu', 'Un seul revenu, c''est un seul point de rupture. Un petit commerce, une compétence vendue le week-end, une location : chaque source supplémentaire réduit ta fragilité.', 'fr'),
('Protéger', 'Intermédiaire', 'Le seuil des 6 mois', 'Six mois de besoins est la cible confortable pour un indépendant. Vise 3 mois d''abord, puis ajoute un mois par trimestre. La progression compte plus que la perfection.', 'fr'),
('Protéger', 'Intermédiaire', 'Assurance pour ton activité', 'Si ton revenu dépend d''un commerce, d''un véhicule ou de tes mains, protège cet outil de travail. Une assurance activité coûte moins cher qu''un arrêt complet.', 'fr'),
('Protéger', 'Avancé', 'Un proche informé', 'Quelqu''un de confiance doit savoir où sont tes comptes, tes contrats et tes accès en cas d''urgence. Prépare une note simple, mise à jour une fois par an.', 'fr'),
('Protéger', 'Avancé', 'Diversifie tes lieux', 'N''aie pas tout au même endroit : un peu de liquidité, un peu en banque, un peu en Mobile Money. Un blocage technique ou une fermeture ne doit pas te couper de tout ton argent.', 'fr'),
('Protéger', 'Avancé', 'Révision annuelle', 'Une fois par an, vérifie tes assurances, ton fonds d''urgence et tes accès. Ta vie change, tes protections doivent suivre. Une demi-heure par an peut éviter un gros problème.', 'fr'),
-- Mentalité
('Mentalité', 'Débutant', 'Richesse = liberté', 'La richesse n''est pas une voiture ou un écran plat. C''est la capacité de choisir ta vie sans dépendre d''un salaire. Chaque franc épargné est une petite liberté gagnée.', 'fr'),
('Mentalité', 'Débutant', 'Ne te compare pas', 'Tu ne connais pas les dettes derrière les apparences. Compare-toi à toi-même d''il y a un an, pas au voisin. Ton rythme est le seul qui compte.', 'fr'),
('Mentalité', 'Débutant', 'Commence imparfaitement', 'Attendre le bon moment pour épargner, c''est déjà perdre des mois. Commence avec ce que tu as aujourd''hui, ajuste ensuite. Les petits gestes répétés battent les grands plans jamais lancés.', 'fr'),
('Mentalité', 'Débutant', 'Parle d''argent simplement', 'Dire « je n''ai pas prévu ça dans mon budget » n''est pas une honte. Assumer ses limites protège ton argent et tes relations. La transparence attire les bonnes occasions.', 'fr'),
('Mentalité', 'Intermédiaire', 'L''argent est un outil', 'L''argent ne te définit pas, il te donne des options. Dépense pour ce qui compte vraiment pour toi, coupe le reste sans culpabilité. Un budget, c''est choisir, pas se priver.', 'fr'),
('Mentalité', 'Intermédiaire', 'La patience est un actif', 'Les rendements arrivent avec le temps. Un capital qui grandit lentement résiste aux modes. Si quelqu''un te promet un enrichissement rapide et garanti, c''est le moment de partir.', 'fr'),
('Mentalité', 'Intermédiaire', 'Célèbre les paliers', 'Marque chaque étape : premier mois d''épargne, premier 100 000 FCFA, fonds d''urgence terminé. Ce sont ces victoires visibles qui rendent l''effort durable.', 'fr'),
('Mentalité', 'Avancé', 'Ta compétence est un asset', 'Une compétence qui se vend vaut plus qu''un objet : elle ne se casse pas et peut augmenter. Investir dans une formation utile est souvent le rendement le plus rapide.', 'fr'),
('Mentalité', 'Avancé', 'Décide avec des chiffres', 'Avant une grosse décision, écris les chiffres : montant, durée, impact sur ton épargne, risque. Écrire calme l''émotion et révèle les mauvaises affaires.', 'fr'),
('Mentalité', 'Avancé', 'La liberté se prépare', 'La liberté financière n''est pas un jour magique. C''est une série de choix : moins de charges, plus d''assets, de la protection. Chaque mois compte, même les mois difficiles.', 'fr')
on conflict (title, locale) do update
  set category = excluded.category,
      level = excluded.level,
      body = excluded.body;

insert into public.challenges (title, description, duration_days)
select * from (values
  ('7 jours sans dépense d''envie', 'Une semaine sans sortie, sans shopping non prévu. Note chaque envie sans la satisfaire.', 7),
  ('Réduire un besoin de 10 %', 'Choisis un besoin récurrent et baisse-le de 10 % ce mois-ci. Mets la différence en épargne.', 30),
  ('Premier versement dans un asset', 'Mets une somme, même petite, dans quelque chose qui produit un revenu.', 30)
) as c(title, description, duration_days)
where not exists (select 1 from public.challenges ch where ch.title = c.title);
