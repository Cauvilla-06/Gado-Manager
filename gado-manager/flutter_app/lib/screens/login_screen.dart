import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'farm_selection_screen.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serverCtrl = TextEditingController(text: 'http://10.0.2.2:3000');
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  bool _discovering = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _discoverServer();
  }

  /// Try to discover the server URL automatically.
  Future<void> _discoverServer() async {
    setState(() {
      _discovering = true;
      _error = null;
    });
    try {
      final url = await AuthService().discoverServerUrl();
      if (url != null && mounted) {
        setState(() {
          _serverCtrl.text = url;
          _discovering = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Servidor encontrado: $url'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } else if (mounted) {
        setState(() {
          _discovering = false;
          _error = 'Servidor não encontrado automaticamente.\n'
              'Verifique se o servidor está rodando e tente novamente,\n'
              'ou insira o endereço manualmente.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _discovering = false;
          _error = 'Erro ao detectar servidor.';
        });
      }
    }
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await AuthService().login(
        _serverCtrl.text,
        _emailCtrl.text,
        _passwordCtrl.text,
      );
      if (!mounted) return;

      // Check farms and navigate accordingly
      final auth = AuthService();
      final api = ApiService(auth);
      try {
        final farms = await api.fetchFarms();
        if (!mounted) return;

        if (farms.isEmpty) {
          // No farms — go to home, user can create from there
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
          );
        } else if (farms.length == 1) {
          // One farm — auto-select
          await auth.setSelectedFarm(farms.first.id, farms.first.name);
          await api.switchFarm(farms.first.id);
          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
          );
        } else {
          // Multiple farms — show selection
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const FarmSelectionScreen()),
          );
        }
      } catch (_) {
        // If farm fetch fails, just go to home
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      // Mostra a mensagem de erro real para facilitar o diagnóstico
      final msg = e.toString().replaceFirst('Exception: ', '');
      setState(() => _error = msg.isNotEmpty
          ? msg
          : 'Não foi possível entrar. Verifique o servidor e as credenciais.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.agriculture,
                      size: 64, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 8),
                  Text(
                    'GadoManager',
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Registre no campo, sincronize quando tiver internet',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _serverCtrl,
                    keyboardType: TextInputType.url,
                    decoration: InputDecoration(
                      labelText: 'Endereço do servidor',
                      hintText: 'http://192.168.0.10:3000',
                      border: const OutlineInputBorder(),
                      prefixIcon: _discovering
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: Padding(
                                padding: EdgeInsets.all(12),
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : const Icon(Icons.dns),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.search),
                        tooltip: 'Detectar servidor automaticamente',
                        onPressed: _discoverServer,
                      ),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Informe o servidor' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'E-mail',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Informe o e-mail' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Senha',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Informe a senha' : null,
                    onFieldSubmitted: (_) => _login(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!,
                        style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _loading ? null : _login,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Entrar'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _discovering
                        ? 'Detectando servidor...'
                        : 'Toque no ícone de lupa para detectar automaticamente.\n'
                            'Ou insira o endereço manualmente.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
