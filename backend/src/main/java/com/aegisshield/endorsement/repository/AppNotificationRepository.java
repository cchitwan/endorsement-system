package com.aegisshield.endorsement.repository;

import com.aegisshield.endorsement.model.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AppNotificationRepository extends JpaRepository<AppNotification, String> {
    List<AppNotification> findByEmployerId(String employerId);
}
