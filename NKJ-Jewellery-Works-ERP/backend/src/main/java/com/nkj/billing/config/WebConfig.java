package com.nkj.billing.config;

import java.util.Arrays;

import com.nkj.billing.realtime.RealtimeMutationInterceptor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor auth;
    private final RealtimeMutationInterceptor realtimeMutationInterceptor;
    private final String[] allowedOrigins;

    public WebConfig(
            AuthInterceptor auth,
            RealtimeMutationInterceptor realtimeMutationInterceptor,
            @Value("${nkj.cors.allowed-origins:http://localhost:*,http://127.0.0.1:*}") String allowedOrigins) {
        this.auth = auth;
        this.realtimeMutationInterceptor = realtimeMutationInterceptor;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(auth)
                .addPathPatterns("/api/admin/**", "/api/invoices", "/api/invoices/**", "/api/events");
        registry.addInterceptor(realtimeMutationInterceptor)
                .addPathPatterns("/api/**");
    }
}
