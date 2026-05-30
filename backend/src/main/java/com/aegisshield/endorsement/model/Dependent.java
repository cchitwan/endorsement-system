package com.aegisshield.endorsement.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Dependent {
    private String name;
    private String relationship; // "SPOUSE", "CHILD"
    private String dob;          // "YYYY-MM-DD"

    public int getAge() {
        if (dob == null || dob.isBlank()) return 0;
        try {
            return (int) java.time.temporal.ChronoUnit.YEARS.between(
                    java.time.LocalDate.parse(dob),
                    java.time.LocalDate.now()
            );
        } catch (Exception e) {
            return 0;
        }
    }
}
