package dz.company.distributor.transfers;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransferItemRepository extends JpaRepository<TransferItem, Long> {
    List<TransferItem> findByTransferId(Long transferId);
}
