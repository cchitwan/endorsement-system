package com.aegisshield.endorsement.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "transactions")
public class Transaction {
    @Id
    private String id;
    private String employerId;
    private String date; // ISO date-time string / timestamp
    private String type; // "DEPOSIT", "ENDORSEMENT_DEBIT", "ENDORSEMENT_CREDIT"
    private double amount;
    private String description;
    private String endorsementId;
    private double balanceAfter;
}
