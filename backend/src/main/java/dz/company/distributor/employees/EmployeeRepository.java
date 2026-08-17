package dz.company.distributor.employees;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> findByWarehouseId(Long warehouseId);
    List<Employee> findByWarehouseIdAndActiveTrue(Long warehouseId);
    List<Employee> findByActiveTrue();
}
