import { createContext, useContext, useState } from 'react'

const defaultState = {
  uploadSource: null,
  uploadedFile: null,
  analysisResult: null,
  analysisRan: false,
  approvedSkus: [],
  rejectedSkus: [],
  editedDescriptions: {},
  changesApplied: false,
  downloadReady: false,
}

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [uploadSource, setUploadSource] = useState(defaultState.uploadSource)
  const [uploadedFile, setUploadedFile] = useState(defaultState.uploadedFile)
  const [analysisResult, setAnalysisResult] = useState(defaultState.analysisResult)
  const [analysisRan, setAnalysisRan] = useState(defaultState.analysisRan)
  const [approvedSkus, setApprovedSkus] = useState(defaultState.approvedSkus)
  const [rejectedSkus, setRejectedSkus] = useState(defaultState.rejectedSkus)
  const [editedDescriptions, setEditedDescriptions] = useState(defaultState.editedDescriptions)
  const [changesApplied, setChangesApplied] = useState(defaultState.changesApplied)
  const [downloadReady, setDownloadReady] = useState(defaultState.downloadReady)

  function approveSkus(skuList) {
    setApprovedSkus(prev => [...new Set([...prev, ...skuList])])
    setRejectedSkus(prev => prev.filter(s => !skuList.includes(s)))
  }

  function rejectSkus(skuList) {
    setRejectedSkus(prev => [...new Set([...prev, ...skuList])])
    setApprovedSkus(prev => prev.filter(s => !skuList.includes(s)))
  }

  function toggleApprove(sku) {
    if (rejectedSkus.includes(sku)) {
      setRejectedSkus(prev => prev.filter(s => s !== sku))
      setApprovedSkus(prev => [...new Set([...prev, sku])])
    } else {
      setApprovedSkus(prev => prev.filter(s => s !== sku))
      setRejectedSkus(prev => [...new Set([...prev, sku])])
    }
  }

  function setEditedDescription(sku, text) {
    setEditedDescriptions(prev => ({ ...prev, [sku]: text }))
  }

  function resetAll() {
    setUploadSource(defaultState.uploadSource)
    setUploadedFile(defaultState.uploadedFile)
    setAnalysisResult(defaultState.analysisResult)
    setAnalysisRan(defaultState.analysisRan)
    setApprovedSkus(defaultState.approvedSkus)
    setRejectedSkus(defaultState.rejectedSkus)
    setEditedDescriptions(defaultState.editedDescriptions)
    setChangesApplied(defaultState.changesApplied)
    setDownloadReady(defaultState.downloadReady)
  }

  return (
    <CatalogContext.Provider value={{
      uploadSource, setUploadSource,
      uploadedFile, setUploadedFile,
      analysisResult, setAnalysisResult,
      analysisRan, setAnalysisRan,
      approvedSkus, rejectedSkus,
      editedDescriptions,
      approveSkus, rejectSkus, toggleApprove,
      setEditedDescription,
      changesApplied, setChangesApplied,
      downloadReady, setDownloadReady,
      resetAll,
    }}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider')
  return ctx
}
