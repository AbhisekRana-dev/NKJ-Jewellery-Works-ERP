package com.nkj.billing;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
@SpringBootApplication
@EnableScheduling
public class NkjBillingApplication { public static void main(String[] args){SpringApplication.run(NkjBillingApplication.class,args);} }
