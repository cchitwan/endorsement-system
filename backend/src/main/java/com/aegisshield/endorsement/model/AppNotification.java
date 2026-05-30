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
@Table(name = "app_notifications")
public class AppNotification {
    @Id
    private String id;
    private String employerId;
    private String relatedId;
    private String title;
    private String message;
    private String type; // "info", "success", "warning", "error" (lowercase)
    private String timestamp;
    private boolean read;
}
