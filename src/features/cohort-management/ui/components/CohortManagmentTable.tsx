import StyledTable from "../../../../shared/ui/StyledTable";
import { IconBlendMode} from '@tabler/icons-react';
import CohortActionsMenu from "./CohortActionsMenu";
import { Check } from "react-feather";

const ProductTable: React.FC = () => {
      const onCohortAction = (p: string, action: "edit" | "delete" | "deploy" | "analyze") => {
      };

    return(
        <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 360 }}
          type="search"
          placeholder="Search by name, description"

        />
        <div  className="d-flex align-items-center gap-2">
          <button className='btn btn-outline-secondary md-0 ' >
            <IconBlendMode size={16} stroke={3} className="me-2" aria-hidden />
            Combine
          </button>    
          <button className='btn btn-outline-secondary md-0 ' >
            <i className="fa-solid fa-copy me-2"/>
            Clone
          </button>
          <button className="btn btn-primary">
            <i className="fa-solid fa-plus me-2"/>
            New Cohort
          </button>
        </div>
      </div>
        <StyledTable>
            <thead>
                <tr>
                    <th><input type="checkbox"/></th>
                    <th>Cohort ID</th>
                    <th>Cohort Name</th>
                    <th>Cohort Description</th>
                    <th>Cohort Definition</th>
                    <th>Patient Count</th>
                    <th>Cohort Deployed</th>
                    <th>Last Update</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><input type="checkbox"/></td>
                    <td>Dm2_1753717199</td>
                    <td>Mark's Cohort</td>
                    <td>
                        <details>
                            <summary>The cohort consists of patients aged 31 years and ...</summary>
                            The cohort consists of patients aged 31 years and older who have been diagnosed with type 2 diabetes mellitus (DM2).
                        </details>
                    </td>
                    <td>
                        json sample
                    </td>
                    <td>26</td>
                    <td>True</td>
                    <td>09/01/2025 12:25AM</td>
                    <td>
                        <CohortActionsMenu cohort_id="Dm2_1753717199" onAction={(action) => onCohortAction("", action)}/>
                    </td>
                </tr>
                <tr>
                    <td><input type="checkbox"/></td>
                    <td>Dm2_1753717199</td>
                    <td>Mark's Cohort</td>
                    <td>
                        <details>
                            <summary>The cohort consists of patients aged 31 years and ...</summary>
                            The cohort consists of patients aged 31 years and older who have been diagnosed with type 2 diabetes mellitus (DM2).
                        </details>
                    </td>
                    <td>
                        json sample
                    </td>
                    <td>26</td>
                    <td>True</td>
                    <td>09/01/2025 12:25AM</td>
                    <td>
                        <CohortActionsMenu cohort_id="Dm2_1753717199" onAction={(action) => onCohortAction("", action)}/>
                    </td>
                </tr>                
            </tbody>
        </StyledTable>
        </>
    )
}

export default ProductTable;