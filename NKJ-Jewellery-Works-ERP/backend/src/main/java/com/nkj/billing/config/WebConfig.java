package com.nkj.billing.config;

import java.util.Arrays;
import java.util.stream.Stream;

import com.nkj.billing.realtime.RealtimeMutationInterceptor;
import com.nkj.billing.service.JewelleryDesignImageStorageService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor auth;
    private final RealtimeMutationInterceptor realtimeMutationInterceptor;
    private final String[] allowedOrigins;
    private final JewelleryDesignImageStorageService imageStorage;

    public WebConfig(
            AuthInterceptor auth,
            RealtimeMutationInterceptor realtimeMutationInterceptor,
            JewelleryDesignImageStorageService imageStorage,
            @Value("${nkj.cors.allowed-origins:http://localhost:*,http://127.0.0.1:*}") String allowedOrigins,
            @Value("${nkj.designs.mobile-upload-allow-private-http:false}") boolean allowPrivateHttpMobileUploads) {
        this.auth = auth;
        this.realtimeMutationInterceptor = realtimeMutationInterceptor;
        this.imageStorage = imageStorage;
        String[] configuredOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
        String[] privateLanOrigins = {
                "http://192.168.*:*", "http://10.*:*",
                "http://172.16.*:*", "http://172.17.*:*", "http://172.18.*:*", "http://172.19.*:*",
                "http://172.20.*:*", "http://172.21.*:*", "http://172.22.*:*", "http://172.23.*:*",
                "http://172.24.*:*", "http://172.25.*:*", "http://172.26.*:*", "http://172.27.*:*",
                "http://172.28.*:*", "http://172.29.*:*", "http://172.30.*:*", "http://172.31.*:*"
        };
        this.allowedOrigins = allowPrivateHttpMobileUploads
                ? Stream.concat(Arrays.stream(configuredOrigins), Arrays.stream(privateLanOrigins))
                        .distinct().toArray(String[]::new)
                : configuredOrigins;
    }

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager("jewelleryPublicCategories", "jewelleryAdminCategories");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = imageStorage.getUploadRoot().toUri().toString();
        if (!location.endsWith("/")) location += "/";
        registry.addResourceHandler("/api/uploads/designs/**")
                .addResourceLocations(location)
                .setCachePeriod(3600);
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
