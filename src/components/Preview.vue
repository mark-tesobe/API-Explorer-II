<script setup lang="ts">
import { ref, reactive, inject, onBeforeMount } from 'vue'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { getOperationDetails } from '../obp/resource-docs'
import type { ElNotification, FormInstance } from 'element-plus'
import { version, get, create, update, discard, createEntitlement, getCurrentUser } from '../obp'
import { getGroupedResourceDocs } from '../obp/resource-docs'

const elMessageDuration = 5500
const configVersion = 'OBP' + version
const url = ref('')
const roleName = ref('')
const method = ref('')
const header = ref('')
const responseHeaderTitle = ref('TYPICAL SUCCESSFUL RESPONSE')
const successResponseBody = ref('')
const exampleRequestBody = ref('')
const requiredRoles = ref([])
const validations = ref([])
const possibleErrors = ref([])
const connectorMethods = ref([])
const showRequiredRoles = ref(true)
const showValidations = ref(true)
const showPossibleErrors = ref(true)
const showConnectorMethods = ref(true)
const isUserLogon = ref(true)
const type = ref('')
const resourceDocs = inject('OBP-ResourceDocs')
const docs = getGroupedResourceDocs(configVersion, resourceDocs)
const footNote = ref({
  operationId: '',
  version: '',
  functionName: '',
  messageTags: ''
})

const requestFormRef = reactive<FormInstance>({})
const requestForm = reactive({ url: '' })

const roleFormRef = reactive<FormInstance>({})
const roleForm = reactive({})

const setOperationDetails = (id: string, version: string): void => {
  const operation = getOperationDetails(version, id, resourceDocs)
  url.value = operation.specified_url
  method.value = operation.request_verb
  exampleRequestBody.value = JSON.stringify(operation.example_request_body)
  requiredRoles.value = operation.roles || []
  possibleErrors.value = operation.error_response_bodies
  connectorMethods.value = operation.connector_methods
  showRequiredRoles.value = requiredRoles.value.some((role) => role.requires_bank_id)
  showValidations.value = validations.value.length > 0
  showPossibleErrors.value = possibleErrors.value.length > 0
  showConnectorMethods.value = connectorMethods.value.length > 0
  footNote.value.version = operation.operation_id
  footNote.value.version = operation.implemented_by.version
  footNote.value.functionName = operation.implemented_by.function
  footNote.value.messageTags = operation.tags.join(',')

  highlightCode(operation.success_response_body)
  setType(method.value)
}

const setRoleForm = () => {
  if (requiredRoles.value) {
    requiredRoles.value.forEach((role, idx) => {
      if (role.requires_bank_id) {
        roleForm[`role${role.role}${idx}`] = role.role
      }
    })
  }
}

const setType = (method) => {
  switch (method) {
    case 'POST': {
      type.value = 'success'
      break
    }
    case 'PUT': {
      type.value = 'warning'
      break
    }
    case 'DELETE': {
      type.value = 'danger'
      break
    }
    default: {
      type.value = 'primary'
      break
    }
  }
}
const submitRequest = async () => {
  if (url.value) {
    switch (method.value) {
      case 'POST': {
        highlightCode(await create(url.value, exampleRequestBody.value))
        break
      }
      case 'PUT': {
        highlightCode(await update(url.value, exampleRequestBody.value))
        break
      }
      case 'DELETE': {
        highlightCode(await discard(url.value))
        break
      }
      default: {
        highlightCode(await get(url.value))
        break
      }
    }
    responseHeaderTitle.value = 'RESPONSE'
  } else {
    ElNotification({
      duration: elMessageDuration,
      message: 'URL path is required.',
      type: 'error'
    })
  }
}
const submit = async (form: FormInstance, fn: () => void) => {
  if (!form) return
  fn(form).then(() => {})
}
const highlightCode = (json) => {
  if (json) {
    successResponseBody.value = hljs.lineNumbersValue(
      hljs.highlightAuto(JSON.stringify(json, null, 4), ['JSON']).value
    )
  } else {
    successResponseBody.value = ''
  }
}
const submitEntitlement = async () => {
  requiredRoles.value.forEach(async (formRole, idx) => {
    if (formRole.requires_bank_id) {
      const role = roleForm[`role${formRole.role}${idx}`]
      const bankId = roleForm[`bankId${formRole.role}${idx}`]
      if (role && bankId && isUserLogon) {
        const response = await createEntitlement(bankId, role)
        let type = 'success'
        if ('code' in response && response['code'] >= 400) {
          type = 'error'
        }
        ElNotification({
          duration: elMessageDuration,
          message: response.message,
          position: 'bottom-right',
          type
        })
      } else {
        ElNotification({
          duration: elMessageDuration,
          message: 'Bank Id is required.',
          position: 'bottom-right',
          type: 'error'
        })
      }
    }
  })
}
onBeforeMount(async () => {
  const route = useRoute()
  const version = route.query.version ? route.query.version : configVersion
  setOperationDetails(route.params.id, version)

  const currentUser = await getCurrentUser()
  isUserLogon.value = currentUser.username
  setRoleForm()
})
onBeforeRouteUpdate((to) => {
  const version = to.query.version ? to.query.version : configVersion
  setOperationDetails(to.params.id, version)
  responseHeaderTitle.value = 'TYPICAL SUCCESSFUL RESPONSE'
  setRoleForm()
})
</script>

<template>
  <main>
    <el-form ref="requestFormRef" :model="requestForm">
      <el-form-item prop="url">
        <div class="flex-request-preview-panel">
          <input type="text" v-model="url" :set="(requestForm.url = url)" id="search-input" />
          <el-button
            :type="type"
            id="search-button"
            @click="submit(requestFormRef, submitRequest)"
            >{{ method }}</el-button
          >
        </div>
      </el-form-item>
    </el-form>
    <div class="flex-preview-panel">
      <input
        type="text"
        v-model="header"
        placeholder="Request Header (Header1:Value1::Header2:Value2)"
      />
    </div>
    <div class="flex-preview-panel">
      <input type="text" v-show="exampleRequestBody" v-model="exampleRequestBody" />
    </div>
    <div v-show="successResponseBody">
      <pre>
        {{responseHeaderTitle}}:
        <code><div id="code" v-html="successResponseBody"></div></code>
      </pre>
    </div>
    <el-form ref="roleFormRef" :model="roleForm">
      <div v-show="showRequiredRoles">
        <p>{{ $t('preview.required_roles') }}:</p>
        <el-alert v-show="!isUserLogon" type="info" show-icon :closable="false">
          <p>Please login to request this Role.</p>
        </el-alert>
        <ul>
          <li
            v-for="(role, idx) in requiredRoles"
            :key="role.role"
            :name="role.role"
            v-show="role.requires_bank_id"
          >
            <p>{{ role.role }}</p>
            <div class="flex-role-preview-panel" id="request-role-button-panel">
              <el-form-item :prop="`bankId${role.role}${idx}`">
                <input
                  type="text"
                  v-model="roleForm[`bankId${role.role}${idx}`]"
                  placeholder="Bank ID"
                />
              </el-form-item>
            </div>
          </li>
        </ul>
        <el-button
          id="request-role-button"
          v-show="isUserLogon"
          @click="submit(roleFormRef, submitEntitlement)"
          >Request</el-button
        >
      </div>
    </el-form>
    <!--<div v-show="showValidations">-->
    <el-divider class="divider" />
    <div>
      <p>{{ $t('preview.validations') }}:</p>
      <!--TODO: implementation; replace hard coded.-->
      <div>
        <ul>
          <li>Required JSON Validation: No</li>
          <li>Allowed Authentication Types: Not set</li>
        </ul>
      </div>
    </div>
    <el-divider class="divider" />
    <div v-show="showPossibleErrors">
      <p>{{ $t('preview.possible_errors') }}:</p>
      <ul>
        <li v-for="error in possibleErrors" :key="error" :name="error">
          {{ error }}
        </li>
      </ul>
    </div>
    <el-divider class="divider" />
    <div v-show="showConnectorMethods">
      <p>{{ $t('preview.connector_methods') }}:</p>
      <ul>
        <li v-for="method in connectorMethods" :key="method" :name="method">
          {{ method }}
        </li>
      </ul>
    </div>
    <el-divider class="divider" />
    <div>
      <p class="footnote">
        Version: {{ footNote.version }}, function_name: by {{ footNote.functionName }},
        operation_id: {{ footNote.functionName }}, Message Tags: {{ footNote.messageTags }}
      </p>
    </div>
    <br />
  </main>
</template>

<style scoped>
template {
  overflow: auto;
  max-height: 900px;
}
main {
  margin: 25px;
  color: #fffff;
  font-family: 'Roboto';
  font-size: 14px;
}
span {
  font-size: 28px;
}
pre {
  margin-left: -25px;
  margin-right: -25px;
  padding: 30px 30px 10px 30px;
  max-height: 340px;
  background-color: #253047;
  font-size: 14px;
  font-family: 'Roboto';
  font-weight: normal;
}
input[type='text'] {
  color: #ffffff;
  font-size: 14px;
  font-family: 'Roboto';
  font-weight: normal;
  border: none;
  width: 100%;
  height: 32px;
  padding-left: 10px;
  background-color: #253047;
  -webkit-border-radius: 5px;
  -moz-border-radius: 5px;
  border-radius: 5px;
}
input[type='text']:focus {
  outline: none;
}
ul {
  margin-left: -10px;
}
li {
  padding: 5px 0 5px 0;
}
.content p a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background-color: var(--el-border-color-light);
  z-index: var(--el-index-normal);
}
.flex-preview-panel {
  display: flex;
  flex-direction: row;
  padding-bottom: 18px;
}
.flex-role-preview-panel {
  display: flex;
  flex-direction: row;
  padding-bottom: 12px;
}
.flex-request-preview-panel {
  display: flex;
  flex-direction: row;
}
.footnote {
  color: var(--el-color-info);
  font-size: 12px;
}
.divider {
  border-top: 1px #253047 solid;
  margin-left: -25px;
  padding-right: 50px;
}
#search-input {
  -webkit-border-top-right-radius: 0;
  -moz-border-top-right-radius: 0;
  border-top-right-radius: 0;
  -webkit-border-bottom-right-radius: 0;
  -moz-border-bottom-right-radius: 0;
  border-bottom-right-radius: 0;
}
#search-button {
  height: 34px;
  -webkit-border-top-left-radius: 0;
  -moz-border-top-left-radius: 0;
  border-top-left-radius: 0;
  -webkit-border-bottom-left-radius: 0;
  -moz-border-bottom-left-radius: 0;
  border-bottom-left-radius: 0;
}
#request-role-button {
  margin-left: 30px;
}
#request-role-button-panel {
  width: 95%;
  margin: 0 0 -30px 0;
}
</style>
