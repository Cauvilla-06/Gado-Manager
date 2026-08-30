# GadoManager Mobile (Flutter)

App Android **offline-first** para registrar informações dos bois no campo e
sincronizar com o servidor quando houver internet.

## Funcionalidades

- 🔐 Login no servidor (mesma conta do site)
- 🐂 Lista de animais baixada do servidor (funciona offline depois da 1ª carga)
- ✍️ Registro offline de:
  - ⚖️ Pesagens (peso + data)
  - 💉 Vacinas (nome, data, próxima dose, lote)
  - 🐛 Vermífugos (nome, dose, datas)
  - 💊 Vitaminas (nome, dose, datas)
- 🔄 Sincronização automática ao abrir o app quando online + botão manual
- Sem duplicação: cada registro tem um ID único (`clientGeneratedId`) que o servidor reconhece

## Como compilar o APK

Requisitos: [Flutter SDK](https://docs.flutter.dev/get-started/install) instalado.

```bash
cd flutter_app

# 1. Gerar a pasta android/ (plataforma) — só na primeira vez
flutter create . --project-name gado_manager --org com.gadomanager --platforms android

# 2. Adicionar permissão de internet em android/app/src/main/AndroidManifest.xml,
#    dentro da tag <manifest>, antes de <application>:
#    <uses-permission android:name="android.permission.INTERNET"/>

# 3. Baixar dependências
flutter pub get

# 4. Compilar o APK release
flutter build apk --release
```

O APK fica em `build/app/outputs/flutter-apk/app-release.apk`.

> Dica: para testes rápidos, `flutter build apk --debug` é mais rápido de gerar.

## Como usar

1. Instale o APK no celular
2. Na tela de login informe:
   - **Endereço do servidor**: o IP do computador rodando `npm run dev`
     na mesma rede Wi-Fi — ex.: `http://192.168.0.10:3000`
     - No emulador Android use `http://10.0.2.2:3000` (aponta para o localhost do PC)
   - E-mail e senha da sua conta do GadoManager
3. Use o botão **"+ Novo Registro"** para lançar pesagens/vacinas/etc. mesmo sem sinal
4. Ao ficar online, toque em **Sincronizar** (ou reabra o app) para enviar tudo

## Arquitetura

```
lib/
├── main.dart                      # Entrada do app + gate de autenticação
├── models.dart                    # Animal, PendingRecord, tipos de registro
├── services/
│   ├── api_service.dart           # Login (Bearer token), buscar animais, /api/sync
│   └── database_helper.dart       # SQLite local (sqflite): cache de animais + pendentes
└── screens/
    ├── login_screen.dart          # Servidor + e-mail + senha
    ├── home_screen.dart           # Lista de animais, status online/offline, sync
    └── add_record_screen.dart     # Formulário dinâmico por tipo de registro
```

**Fluxo offline:** registro salvo no SQLite → quando conecta, o app agrupa os
pendentes por tipo e envia via `POST /api/sync` com header `Authorization: Bearer <token>`.
O servidor deduplica por `clientGeneratedId`, então sincronizar duas vezes nunca duplica.
