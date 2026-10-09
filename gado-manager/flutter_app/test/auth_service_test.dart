import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gado_manager/services/api_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  /// Runs [body] with a mocked HTTP client routed through [handler].
  Future<void> withMockClient(
    Future<void> Function(AuthService auth) body,
    Future<http.Response> Function(http.Request request) handler,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final mock = MockClient((req) async {
      final rebuilt = http.Request(req.method, req.url)
        ..headers.addAll(req.headers);
      if (req.body.isNotEmpty) rebuilt.body = req.body;
      return handler(rebuilt);
    });
    await body(AuthService(client: mock));
  }

  group('normalizeUrl', () {
    test('tunnel host without scheme gets https://', () {
      expect(
        AuthService.normalizeUrl('meu-tunnel-abc123.trycloudflare.com'),
        'https://meu-tunnel-abc123.trycloudflare.com',
      );
    });

    test('tunnel host with http:// is upgraded to https://', () {
      expect(
        AuthService.normalizeUrl('http://meu-tunnel-abc123.trycloudflare.com'),
        'https://meu-tunnel-abc123.trycloudflare.com',
      );
    });

    test('tunnel host with https:// stays https and drops trailing slash', () {
      expect(
        AuthService.normalizeUrl('https://foo.trycloudflare.com/'),
        'https://foo.trycloudflare.com',
      );
    });

    test('local address without scheme keeps http://', () {
      expect(AuthService.normalizeUrl('192.168.1.175:3000'),
          'http://192.168.1.175:3000');
    });

    test('local http:// URL is untouched', () {
      expect(AuthService.normalizeUrl('http://10.0.2.2:3000'),
          'http://10.0.2.2:3000');
    });

    test('ngrok host is upgraded to https://', () {
      expect(AuthService.normalizeUrl('http://abc.ngrok-free.app'),
          'https://abc.ngrok-free.app');
    });
  });

  group('login', () {
    test('success through tunnel URL saves token and server url', () async {
      await withMockClient((auth) async {
        final base = await auth.login(
          'meu-tunnel.trycloudflare.com',
          'demo@gado.com',
          '123456',
        );

        // Must have used https, not http
        expect(base, 'https://meu-tunnel.trycloudflare.com');
        expect(await auth.serverUrl, 'https://meu-tunnel.trycloudflare.com');
        expect(await auth.token, isNotNull);
        expect(await auth.userName, 'Demo User');
      }, (req) async {
        if (req.url.path == '/api/auth/login') {
          expect(req.url.scheme, 'https', reason: 'login must go via https');
          return http.Response(
            jsonEncode({
              'token': 'jwt-token-abc',
              'user': {'id': 'u1', 'name': 'Demo User', 'email': 'demo@gado.com'},
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('not found', 404);
      });
    });

    test('http:// tunnel URL is upgraded before request', () async {
      await withMockClient((auth) async {
        await auth.login(
          'http://tunnel-x.trycloudflare.com',
          'demo@gado.com',
          '123456',
        );
      }, (req) async {
        if (req.url.path == '/api/auth/login') {
          expect(req.url.host, 'tunnel-x.trycloudflare.com');
          expect(req.url.scheme, 'https',
              reason: 'http:// on Cloudflare tunnel gets 301 and drops POST body');
          return http.Response(
            jsonEncode({
              'token': 't',
              'user': {'name': 'U'},
            }),
            200,
          );
        }
        return http.Response('not found', 404);
      });
    });

    test('wrong password surfaces server error instead of fallback loop',
        () async {
      await withMockClient((auth) async {
        await expectLater(
          auth.login('https://tunnel.trycloudflare.com', 'demo@gado.com', 'errada'),
          throwsA(isA<AuthError>()),
        );
        // Server URL must NOT be overwritten by the failed login
        expect(await auth.serverUrl, isNull);
      }, (req) async {
        if (req.url.path == '/api/auth/login') {
          return http.Response(
            jsonEncode({'error': 'Email ou senha incorretos'}),
            401,
          );
        }
        return http.Response('not found', 404);
      });
    });

    test('connection failure falls back to local candidates', () async {
      await withMockClient((auth) async {
        final base = await auth.login(
          'https://dead-tunnel.trycloudflare.com',
          'demo@gado.com',
          '123456',
        );
        expect(base, 'http://10.0.2.2:3000');
      }, (req) async {
        if (req.url.host == 'dead-tunnel.trycloudflare.com') {
          throw Exception('connection refused');
        }
        if (req.url.path == '/api/auth/login') {
          return http.Response(
            jsonEncode({
              'token': 'local-token',
              'user': {'name': 'Local'},
            }),
            200,
          );
        }
        return http.Response('not found', 404);
      });
    });
  });

  group('discovery', () {
    test('saved tunnel URL alive: refreshes tunnel url from server', () async {
      await withMockClient((auth) async {
        await auth.setServerUrl('https://old-tunnel.trycloudflare.com');

        final found = await auth.discoverServerUrl();
        expect(found, 'https://new-tunnel.trycloudflare.com');
        expect(await auth.serverUrl, 'https://new-tunnel.trycloudflare.com');
      }, (req) async {
        if (req.url.host == 'old-tunnel.trycloudflare.com' &&
            req.url.path == '/api/config/server-url') {
          return http.Response(
            jsonEncode({'url': 'https://new-tunnel.trycloudflare.com'}),
            200,
          );
        }
        throw Exception('unreachable');
      });
    });

    test('saved tunnel dead: falls back to local probe', () async {
      await withMockClient((auth) async {
        await auth.setServerUrl('https://dead.trycloudflare.com');

        final found = await auth.discoverServerUrl();
        expect(found, 'http://10.0.2.2:3000');
      }, (req) async {
        if (req.url.host == 'dead.trycloudflare.com') {
          throw Exception('dead tunnel');
        }
        if (req.url.path == '/api/config/server-url') {
          return http.Response(jsonEncode({'url': null}), 200);
        }
        throw Exception('unreachable');
      });
    });

    test('nothing reachable: returns null', () async {
      await withMockClient((auth) async {
        final found = await auth.discoverServerUrl();
        expect(found, isNull);
      }, (req) async {
        throw Exception('offline');
      });
    });

    test('pingServer returns true only for reachable server', () async {
      await withMockClient((auth) async {
        expect(await auth.pingServer('http://10.0.2.2:3000'), isTrue);
        expect(await auth.pingServer('dead-host.example.com'), isFalse);
      }, (req) async {
        if (req.url.host == '10.0.2.2') {
          return http.Response(jsonEncode({'url': null}), 200);
        }
        throw Exception('unreachable');
      });
    });
  });
}
