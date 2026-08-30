package com.gadomanager.data.remote

import com.gadomanager.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    /**
     * URL do servidor lida do BuildConfig.
     * 
     * Para usar tunnel permanente, altere SERVER_URL no build.gradle.kts:
     *   - Emulador:     http://10.0.2.2:3000/
     *   - localtunnel:  https://gadomanager.loca.lt/
     *   - cloudflare:   https://seu-subdominio.trycloudflare.com/
     *   - ngrok:        https://xxxx.ngrok-free.app/
     */
    private val BASE_URL: String = BuildConfig.SERVER_URL

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    /**
     * Interceptor que adiciona headers para evitar bloqueio de tuneis
     * (localtunnel, ngrok, cloudflare, etc.)
     */
    private val tunnelBypassInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .header("bypass-tunnel-reminder", "true")
            .header("ngrok-skip-browser-warning", "true")
            .build()
        chain.proceed(request)
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(tunnelBypassInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    val apiService: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
