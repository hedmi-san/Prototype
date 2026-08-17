package dz.company.distributor.transfers;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransferRepository extends JpaRepository<Transfer, Long> {
    
    @Query("SELECT t FROM Transfer t WHERE t.sourceWarehouse.id = :warehouseId OR t.destinationWarehouse.id = :warehouseId ORDER BY t.createdAt DESC")
    List<Transfer> findByWarehouseInvolved(@Param("warehouseId") Long warehouseId);

    List<Transfer> findAllByOrderByCreatedAtDesc();
    List<Transfer> findByStatus(TransferStatus status);
}
