package dz.company.distributor.salaries;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryRepository extends JpaRepository<SalaryRecord, Long> {
    List<SalaryRecord> findByWarehouseIdOrderByPeriodDesc(Long warehouseId);
    List<SalaryRecord> findAllByOrderByPeriodDesc();
    List<SalaryRecord> findByEmployeeIdOrderByPeriodDesc(Long employeeId);
    Optional<SalaryRecord> findByEmployeeIdAndPeriod(Long employeeId, String period);

    @Query("SELECT s FROM SalaryRecord s WHERE s.period = :period")
    List<SalaryRecord> findByPeriod(@Param("period") String period);

    @Query("SELECT s FROM SalaryRecord s WHERE s.warehouse.id = :warehouseId AND s.period = :period")
    List<SalaryRecord> findByWarehouseIdAndPeriod(@Param("warehouseId") Long warehouseId, @Param("period") String period);
}
