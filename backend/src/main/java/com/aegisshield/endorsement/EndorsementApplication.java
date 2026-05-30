package com.aegisshield.endorsement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EndorsementApplication {
    public static void main(String[] args) {
        SpringApplication.run(EndorsementApplication.class, args);
    }
}
