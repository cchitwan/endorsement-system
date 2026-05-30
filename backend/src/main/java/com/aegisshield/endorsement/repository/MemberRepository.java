package com.aegisshield.endorsement.repository;

import com.aegisshield.endorsement.model.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MemberRepository extends JpaRepository<Member, String> {
    List<Member> findByEmployerId(String employerId);
}
